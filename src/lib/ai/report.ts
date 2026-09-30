import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db";
import { deriveInsights } from "../domain/insights";
import { RULES, describeRule, evaluateRules, ruleSummary, type RuleResult } from "../domain/rules";
import { computeStats } from "../domain/stats";
import { ET, KST, addDays, fmt, mondayOf } from "../domain/time";
import type { PositionView } from "../domain/types";
import { listPositions } from "../repo/positions";
import { getSettings } from "../settings";
import { splitPastedReport } from "../domain/pasted";
import { AiError, FALLBACK, REPORT_EFFORT, REPORT_MODEL, anthropic } from "./client";

const Report = z.object({
  focus: z.string().describe("다음 주에 집중할 단 한 가지 행동 규칙 (한 문장)"),
  markdown: z.string().describe("리포트 본문 (한국어 마크다운)"),
});

export const REPORT_SYSTEM = `당신은 미국 주식 스캘핑 트레이더의 매매 코치입니다. 사용자의 한 주 매매 기록과 통계를 보고 주간 리뷰를 한국어로 작성합니다.

원칙:
- 숫자와 실제 매매 사례(티커·시각)를 근거로 말합니다. 일반론적인 조언은 피합니다.
- 사용자가 적은 매수/매도 사유와 실제 결과(MAE/MFE, 매도 후 흐름)를 대조해 사고 패턴의 문제를 찾습니다.
- 손익 금액보다 과정(그라운드 룰 준수, 손절 규율, 진입 타이밍, 과매매)에 초점을 둡니다.
- 사용자가 스스로 정한 그라운드 룰(groundRules)을 기준으로 평가하고, 룰을 지킨 매매와 어긴 매매의 결과를 비교합니다.
- 표본이 적으면 단정하지 말고 그 점을 밝힙니다.
- 모바일에서 읽기 좋게 짧은 문단과 목록을 씁니다. 표는 쓰지 않습니다.

본문(markdown) 구성:
## 한 줄 요약
## 이번 주 숫자 (핵심 지표 3~5개와 해석)
## 잘한 점
## 그라운드 룰 점검 (룰별 위반 횟수와 위반 매매의 손익, 가장 비싼 위반)
## 반복된 실수
## 사유 vs 결과 (기록된 사유와 실제 흐름의 불일치 사례)
## 지난 과제 점검 (지난 리포트의 과제가 있으면 지켜졌는지)
## 다음 주 규칙 (구체적인 체크리스트 2~3개)`;

function compactTrade(p: PositionView, violations: RuleResult[] = []) {
  const m = p.metrics;
  const e = p.excursion;
  const pct = (x: number | null | undefined) => (x == null ? null : Math.round(x * 10000) / 100);
  return {
    ticker: p.ticker,
    date: p.tradeDate,
    openKST: fmt(m.openedAt, KST),
    closeKST: m.closedAt ? fmt(m.closedAt, KST) : null,
    holdSec: m.holdSeconds,
    fills: m.fillCount,
    avgEntry: +m.avgEntry.toFixed(4),
    avgExit: m.avgExit ? +m.avgExit.toFixed(4) : null,
    maxQty: m.maxQty,
    netPnlUsd: +m.netPnl.toFixed(2),
    netPnlKrw: Math.round(p.krw.net),
    r: m.rMultiple == null ? null : +m.rMultiple.toFixed(2),
    stopPct: p.stopPct,
    targetPct: p.targetPct,
    setup: p.setupTags,
    emotion: p.emotionTags,
    confidence: p.confidence,
    followedPlan: p.followedPlan,
    entryReason: p.entryReason || null,
    exitReason: p.exitReason || null,
    note: p.note || null,
    ruleViolations: violations.map((v) => `${v.kind === "check" ? "[자가체크 필요] " : ""}${v.message}`),
    wouldReenter: p.wouldReenter,
    maePct: pct(e?.maePct),
    mfePct: pct(e?.mfePct),
    postExit30mHighPct: pct(e?.postExitHighPct),
    preEntry10mPct: pct(e?.preEntryChangePct),
  };
}

/** 가장 최근에 끝난 주의 월요일 (ET 기준) */
export function lastCompletedWeek(now = new Date()): string {
  return addDays(mondayOf(fmt(now, ET, "yyyy-MM-dd")), -7);
}

export interface ReportInput {
  start: string;
  end: string;
  summary: ReturnType<typeof computeStats>["summary"];
  payload: Record<string, unknown>;
}

/** 주간 리포트 입력 데이터 (API 호출과 Claude 앱 붙여넣기용 요청문이 함께 사용) */
export async function buildReportInput(weekStart: string): Promise<ReportInput> {
  const db = await getDb();
  const start = mondayOf(weekStart);
  const end = addDays(start, 6);
  const week = await listPositions({ from: start, to: end });
  const closed = week.filter((p) => p.metrics.status === "closed");
  if (closed.length === 0) throw new AiError("해당 주에 청산된 매매가 없습니다");

  const stats = computeStats(week, { tz: KST, ref: new Date(`${start}T16:00:00Z`) });
  const { rules } = await getSettings();
  const ruleResults = evaluateRules(week, rules);
  const rs = ruleSummary(week, ruleResults);
  const prior = computeStats(await listPositions({ from: addDays(start, -28), to: addDays(start, -1) }));
  const [prev] = await db
    .select({ focus: schema.aiReports.focus })
    .from(schema.aiReports)
    .where(lt(schema.aiReports.periodStart, start))
    .orderBy(desc(schema.aiReports.periodStart))
    .limit(1);

  return {
    start,
    end,
    summary: stats.summary,
    payload: {
      period: { start, end, note: "날짜는 미국 거래일(한국시간 밤 장 시작일), 시각은 한국시간(KST)" },
      summary: stats.summary,
      daily: stats.daily,
      breakdowns: stats.breakdowns,
      excursion: stats.excursion,
      ruleBasedInsights: deriveInsights(stats),
      groundRules: RULES.filter((r) => rules.enabled[r.id]).map((r) => `${r.no}. ${r.title}: ${describeRule(r.id, rules)}`),
      groundRuleSummary: {
        compliance: rs.compliance,
        cleanNetKrw: Math.round(rs.cleanNet),
        violatingNetKrw: Math.round(rs.violatingNet),
        byRule: rs.rows.filter((r) => r.count).map((r) => ({ rule: `${r.no}. ${r.title}`, count: r.count, netKrw: Math.round(r.netKrw) })),
      },
      previous4Weeks: prior.summary.count ? prior.summary : null,
      previousFocus: prev?.focus ?? null,
      trades: closed.sort((a, b) => a.metrics.openedAt.getTime() - b.metrics.openedAt.getTime()).map((p) => compactTrade(p, ruleResults.get(p.id))),
    },
  };
}

const DATA_NOTE = "통계(summary·daily·breakdowns 등)의 금액은 원화(KRW). 매매별 가격(avgEntry 등)은 USD, 손익은 netPnlKrw(원)·netPnlUsd 둘 다 제공. 퍼센트 필드는 % 값, holdSec 는 초. 리포트의 금액은 원화로 표기하세요.";

/** Claude 앱(구독)에 그대로 붙여넣을 요청문 */
export function buildReportPrompt(input: ReportInput): string {
  return `${REPORT_SYSTEM}

응답 형식:
- 첫 줄은 반드시 "집중할 한 가지: " 로 시작하는 한 문장 (다음 주에 집중할 단 한 가지 행동 규칙)
- 그 다음 줄부터 위 구성의 마크다운 본문
- 표와 코드 블록은 쓰지 않습니다

아래는 ${input.start} ~ ${input.end} 주간 데이터입니다. ${DATA_NOTE}

${JSON.stringify(input.payload)}`;
}

async function existingReport(start: string, end: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: schema.aiReports.id })
    .from(schema.aiReports)
    .where(and(eq(schema.aiReports.periodStart, start), eq(schema.aiReports.periodEnd, end)));
  return row?.id ?? null;
}

async function saveReport(values: typeof schema.aiReports.$inferInsert, replace: boolean) {
  const db = await getDb();
  if (replace)
    await db
      .delete(schema.aiReports)
      .where(and(eq(schema.aiReports.periodStart, values.periodStart), eq(schema.aiReports.periodEnd, values.periodEnd)));
  const [row] = await db.insert(schema.aiReports).values(values).returning({ id: schema.aiReports.id });
  return row.id;
}

/** Claude 앱에서 받은 리포트를 붙여넣어 저장 */
export async function saveManualReport(weekStart: string, text: string) {
  const input = await buildReportInput(weekStart);
  const { focus, markdown } = splitPastedReport(text);
  if (!markdown) throw new AiError("리포트 내용이 비어 있습니다");
  const id = await saveReport(
    { periodStart: input.start, periodEnd: input.end, model: "claude.ai (구독)", content: markdown, focus, stats: input.summary },
    true,
  );
  return { id, created: true };
}

export async function generateWeeklyReport(weekStart: string, opts: { force?: boolean } = {}) {
  const start = mondayOf(weekStart);
  const end = addDays(start, 6);
  if (!opts.force) {
    const id = await existingReport(start, end);
    if (id) return { id, created: false };
  }
  const input = await buildReportInput(start);

  const res = await anthropic().beta.messages.parse({
    model: REPORT_MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    thinking: { type: "adaptive" },
    output_config: { effort: REPORT_EFFORT, format: betaZodOutputFormat(Report) },
    system: REPORT_SYSTEM,
    messages: [{ role: "user", content: `${DATA_NOTE}\n\n${JSON.stringify(input.payload)}` }],
  });
  if (res.stop_reason === "refusal") throw new AiError("AI 가 리포트 생성을 거절했습니다");
  if (!res.parsed_output) throw new AiError("리포트 생성에 실패했습니다");

  const id = await saveReport(
    {
      periodStart: start,
      periodEnd: end,
      model: res.model,
      content: res.parsed_output.markdown,
      focus: res.parsed_output.focus,
      stats: input.summary,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    },
    Boolean(opts.force),
  );
  return { id, created: true };
}
