import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db";
import { deriveInsights } from "../domain/insights";
import { computeStats } from "../domain/stats";
import { ET, addDays, fmt, mondayOf } from "../domain/time";
import type { PositionView } from "../domain/types";
import { listPositions } from "../repo/positions";
import { AiError, FALLBACK, REPORT_EFFORT, REPORT_MODEL, anthropic } from "./client";

const Report = z.object({
  focus: z.string().describe("다음 주에 집중할 단 한 가지 행동 규칙 (한 문장)"),
  markdown: z.string().describe("리포트 본문 (한국어 마크다운)"),
});

const SYSTEM = `당신은 미국 주식 스캘핑 트레이더의 매매 코치입니다. 사용자의 한 주 매매 기록과 통계를 보고 주간 리뷰를 한국어로 작성합니다.

원칙:
- 숫자와 실제 매매 사례(티커·시각)를 근거로 말합니다. 일반론적인 조언은 피합니다.
- 사용자가 적은 매수/매도 사유와 실제 결과(MAE/MFE, 매도 후 흐름)를 대조해 사고 패턴의 문제를 찾습니다.
- 손익 금액보다 과정(계획 준수, 손절 규율, 진입 타이밍, 과매매)에 초점을 둡니다.
- 표본이 적으면 단정하지 말고 그 점을 밝힙니다.
- 모바일에서 읽기 좋게 짧은 문단과 목록을 씁니다. 표는 쓰지 않습니다.

본문(markdown) 구성:
## 한 줄 요약
## 이번 주 숫자 (핵심 지표 3~5개와 해석)
## 잘한 점
## 반복된 실수
## 사유 vs 결과 (기록된 사유와 실제 흐름의 불일치 사례)
## 지난 과제 점검 (지난 리포트의 과제가 있으면 지켜졌는지)
## 다음 주 규칙 (구체적인 체크리스트 2~3개)`;

function compactTrade(p: PositionView) {
  const m = p.metrics;
  const e = p.excursion;
  const pct = (x: number | null | undefined) => (x == null ? null : Math.round(x * 10000) / 100);
  return {
    ticker: p.ticker,
    date: p.tradeDate,
    openET: fmt(m.openedAt, ET),
    closeET: m.closedAt ? fmt(m.closedAt, ET) : null,
    holdSec: m.holdSeconds,
    fills: m.fillCount,
    avgEntry: +m.avgEntry.toFixed(4),
    avgExit: m.avgExit ? +m.avgExit.toFixed(4) : null,
    maxQty: m.maxQty,
    netPnl: +m.netPnl.toFixed(2),
    r: m.rMultiple == null ? null : +m.rMultiple.toFixed(2),
    stop: p.plannedStop,
    target: p.plannedTarget,
    setup: p.setupTags,
    emotion: p.emotionTags,
    confidence: p.confidence,
    followedPlan: p.followedPlan,
    entryReason: p.entryReason || null,
    exitReason: p.exitReason || null,
    note: p.note || null,
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

export async function generateWeeklyReport(weekStart: string, opts: { force?: boolean } = {}) {
  const db = await getDb();
  const start = mondayOf(weekStart);
  const end = addDays(start, 6);

  if (!opts.force) {
    const [existing] = await db
      .select({ id: schema.aiReports.id })
      .from(schema.aiReports)
      .where(and(eq(schema.aiReports.periodStart, start), eq(schema.aiReports.periodEnd, end)));
    if (existing) return { id: existing.id, created: false };
  }

  const week = await listPositions({ from: start, to: end });
  const closed = week.filter((p) => p.metrics.status === "closed");
  if (closed.length === 0) throw new AiError("해당 주에 청산된 매매가 없습니다");

  const stats = computeStats(week);
  const prior = computeStats(await listPositions({ from: addDays(start, -28), to: addDays(start, -1) }));
  const [prev] = await db
    .select({ focus: schema.aiReports.focus, periodStart: schema.aiReports.periodStart })
    .from(schema.aiReports)
    .where(lt(schema.aiReports.periodStart, start))
    .orderBy(desc(schema.aiReports.periodStart))
    .limit(1);

  const payload = {
    period: { start, end, timezone: "America/New_York" },
    summary: stats.summary,
    daily: stats.daily,
    breakdowns: stats.breakdowns,
    excursion: stats.excursion,
    ruleBasedInsights: deriveInsights(stats),
    previous4Weeks: prior.summary.count ? prior.summary : null,
    previousFocus: prev?.focus ?? null,
    trades: closed.sort((a, b) => a.metrics.openedAt.getTime() - b.metrics.openedAt.getTime()).map(compactTrade),
  };

  const res = await anthropic().beta.messages.parse({
    model: REPORT_MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    thinking: { type: "adaptive" },
    output_config: { effort: REPORT_EFFORT, format: betaZodOutputFormat(Report) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `금액 단위 USD, 퍼센트 필드는 % 값, holdSec 는 초.\n\n${JSON.stringify(payload)}`,
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new AiError("AI 가 리포트 생성을 거절했습니다");
  if (!res.parsed_output) throw new AiError("리포트 생성에 실패했습니다");

  const [row] = await db
    .insert(schema.aiReports)
    .values({
      periodStart: start,
      periodEnd: end,
      model: res.model,
      content: res.parsed_output.markdown,
      focus: res.parsed_output.focus,
      stats: stats.summary,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    })
    .returning({ id: schema.aiReports.id });
  return { id: row.id, created: true };
}
