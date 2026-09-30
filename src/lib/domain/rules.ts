import { getTimezoneOffset } from "date-fns-tz";
import { ET, KST, etDate, etMinuteOfDay, fmt } from "./time";
import type { PositionView } from "./types";

/** 1차 그라운드 룰 */
export type RuleId = "lateCutoff" | "bigLossStop" | "openBlackout" | "dailyTarget" | "withdraw" | "stopDiscipline" | "noAdding";

export interface RuleConfig {
  enabled: Record<RuleId, boolean>;
  /** 거래 자금 (원) */
  capitalKrw: number;
  /** 일일 목표 수익률 (거래 자금 대비 %) */
  dailyTargetPct: number;
  /** 이 이상 손실(매매 수익률 %)이 나면 당일 종료 */
  bigLossPct: number;
  /** 신규 진입 마감 (한국시간 HH:mm). 미국 서머타임(여름) / 해제(겨울) */
  cutoffSummer: string;
  cutoffWinter: string;
  /** 정규장 개장 전·후 관망 (분) */
  blackoutBeforeMin: number;
  blackoutAfterMin: number;
  /** 손절선 도달 후 허용 시간 (분) */
  stopGraceMin: number;
  /** 추정 잔고가 거래 자금 대비 이만큼(%) 늘면 초과분 인출 */
  withdrawTriggerPct: number;
  /** 추정 잔고 계산 시작일 (YYYY-MM-DD, 없으면 전체 기록) */
  capitalStartDate: string | null;
}

export const DEFAULT_RULES: RuleConfig = {
  enabled: {
    lateCutoff: true,
    bigLossStop: true,
    openBlackout: true,
    dailyTarget: true,
    withdraw: true,
    stopDiscipline: true,
    noAdding: true,
  },
  capitalKrw: 2_000_000,
  dailyTargetPct: 5,
  bigLossPct: 5,
  cutoffSummer: "00:00",
  cutoffWinter: "00:30",
  blackoutBeforeMin: 10,
  blackoutAfterMin: 3,
  stopGraceMin: 2,
  withdrawTriggerPct: 20,
  capitalStartDate: null,
};

export const RULES: { id: RuleId; no: number; title: string }[] = [
  { id: "lateCutoff", no: 1, title: "늦은 시간 진입 금지" },
  { id: "bigLossStop", no: 2, title: "큰 손실 나면 당일 종료" },
  { id: "openBlackout", no: 3, title: "개장 전후 관망" },
  { id: "dailyTarget", no: 4, title: "일일 목표 달성 시 종료" },
  { id: "withdraw", no: 5, title: "초과분 인출" },
  { id: "stopDiscipline", no: 6, title: "미련 없이 손절" },
  { id: "noAdding", no: 7, title: "물타기·불타기 금지" },
];

/** 룰 설명 (설정값 반영) */
export function describeRule(id: RuleId, c: RuleConfig): string {
  const won = (x: number) => `${Math.round(x).toLocaleString("ko-KR")}원`;
  switch (id) {
    case "lateCutoff":
      return `여름 ${c.cutoffSummer}, 겨울 ${c.cutoffWinter} 이후 신규 진입 금지 (청산은 허용)`;
    case "bigLossStop":
      return `−${c.bigLossPct}% 이상 손실 매매가 나오면 그날 매매 종료`;
    case "openBlackout":
      return `정규장 개장 ${c.blackoutBeforeMin}분 전 ~ 개장 후 ${c.blackoutAfterMin}분 진입 금지`;
    case "dailyTarget":
      return `그날 순이익 +${c.dailyTargetPct}% (${won((c.capitalKrw * c.dailyTargetPct) / 100)}) 달성 시 종료`;
    case "withdraw":
      return `추정 잔고가 ${won(c.capitalKrw * (1 + c.withdrawTriggerPct / 100))} 넘으면 ${won(c.capitalKrw)} 초과분 인출`;
    case "stopDiscipline":
      return `손절선 도달 후 ${c.stopGraceMin}분 넘게 버티지 않기 (다시 봐도 진입할 자리면 홀딩 허용)`;
    case "noAdding":
      return "첫 진입 후 추가 매수 금지 (같은 1분 안의 나눠진 체결은 예외)";
  }
}

export interface RuleResult {
  rule: RuleId;
  /** violation = 위반, check = 자가 체크 필요 */
  kind: "violation" | "check";
  message: string;
}

const MIN = 60_000;
const OPEN_ET_MIN = 9 * 60 + 30;

function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** 해당 시각에 미국 서머타임(EDT)이 적용 중인지 */
export function isUsSummer(d: Date): boolean {
  return getTimezoneOffset(ET, d) === -4 * 3600_000;
}

/** 진입 마감 이후인지 (한국시간 마감 ~ 정오 사이) */
export function isAfterCutoff(d: Date, c: RuleConfig): boolean {
  const cutoff = hhmmToMin(isUsSummer(d) ? c.cutoffSummer : c.cutoffWinter);
  const [h, m] = fmt(d, KST, "H:m").split(":").map(Number);
  const kstMin = h * 60 + m;
  return kstMin >= cutoff && kstMin < 12 * 60;
}

/** 개장 전후 관망 시간인지 */
export function isInBlackout(d: Date, c: RuleConfig): boolean {
  const m = etMinuteOfDay(d);
  return m >= OPEN_ET_MIN - c.blackoutBeforeMin && m < OPEN_ET_MIN + c.blackoutAfterMin;
}

/** 관망 구간의 한국시간 표기 (예: 22:20–22:33) */
export function blackoutLabel(ref: Date, c: RuleConfig): string {
  const day = etDate(ref);
  const at = (min: number) =>
    fmt(new Date(Date.parse(`${day}T00:00:00Z`) - getTimezoneOffset(ET, ref) + min * MIN), KST);
  return `${at(OPEN_ET_MIN - c.blackoutBeforeMin)}–${at(OPEN_ET_MIN + c.blackoutAfterMin)}`;
}

export function dailyTargetKrw(c: RuleConfig): number {
  return (c.capitalKrw * c.dailyTargetPct) / 100;
}

/** 이 매매가 당일 종료 사유(큰 손실)인지 */
function isBigLoss(p: PositionView, c: RuleConfig): boolean {
  return p.metrics.status === "closed" && p.metrics.returnPct * 100 <= -c.bigLossPct;
}

/** 특정 시각 기준, 그날 이미 매매 종료 상태인지 (그 전에 청산된 매매만 반영) */
function endedBefore(sameDay: PositionView[], at: Date, c: RuleConfig): { reason: "bigLoss" | "target"; detail: string } | null {
  const done = sameDay.filter((q) => q.metrics.closedAt && q.metrics.closedAt.getTime() <= at.getTime());
  if (c.enabled.bigLossStop) {
    const big = done.find((q) => isBigLoss(q, c));
    if (big) return { reason: "bigLoss", detail: `${big.ticker} ${(big.metrics.returnPct * 100).toFixed(1)}%` };
  }
  if (c.enabled.dailyTarget) {
    const net = done.reduce((a, q) => a + q.krw.net, 0);
    if (net >= dailyTargetKrw(c)) return { reason: "target", detail: `${Math.round(net).toLocaleString("ko-KR")}원` };
  }
  return null;
}

/** 모든 포지션의 룰 판정 결과 (id → 결과 목록) */
export function evaluateRules(positions: PositionView[], c: RuleConfig): Map<number, RuleResult[]> {
  const out = new Map<number, RuleResult[]>();
  const byDay = new Map<string, PositionView[]>();
  for (const p of positions) byDay.set(p.tradeDate, [...(byDay.get(p.tradeDate) ?? []), p]);

  for (const p of positions) {
    const r: RuleResult[] = [];
    const entry = p.metrics.openedAt;
    const sameDay = (byDay.get(p.tradeDate) ?? []).filter((q) => q.id !== p.id);

    if (c.enabled.lateCutoff && isAfterCutoff(entry, c))
      r.push({ rule: "lateCutoff", kind: "violation", message: `${fmt(entry, KST)} 진입 (마감 이후)` });

    if (c.enabled.openBlackout && isInBlackout(entry, c))
      r.push({ rule: "openBlackout", kind: "violation", message: `${fmt(entry, KST)} 진입 (개장 전후 관망 시간)` });

    const ended = endedBefore(sameDay, entry, c);
    if (ended?.reason === "bigLoss")
      r.push({ rule: "bigLossStop", kind: "violation", message: `큰 손실(${ended.detail}) 후 추가 매매` });
    if (ended?.reason === "target")
      r.push({ rule: "dailyTarget", kind: "violation", message: `목표 달성(${ended.detail}) 후 추가 매매` });

    if (c.enabled.noAdding) {
      const buys = p.executions.filter((e) => e.side === "buy").sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());
      const firstMin = Math.floor(buys[0].executedAt.getTime() / MIN);
      const added = buys.filter((e) => Math.floor(e.executedAt.getTime() / MIN) > firstMin);
      if (added.length) {
        const avg = buys[0].price;
        const down = added.some((e) => e.price < avg);
        r.push({ rule: "noAdding", kind: "violation", message: `추가 매수 ${added.length}회 (${down ? "물타기" : "불타기"})` });
      }
    }

    if (c.enabled.stopDiscipline && p.stopPct != null) {
      const delay = p.excursion?.stopHitDelayMin;
      if (delay != null && delay > c.stopGraceMin) {
        if (p.wouldReenter === true) {
          // 다시 봐도 진입할 자리라 홀딩 → 룰 허용
        } else if (p.wouldReenter === false) {
          r.push({ rule: "stopDiscipline", kind: "violation", message: `손절선 도달 후 ${Math.round(delay)}분 더 보유` });
        } else {
          r.push({ rule: "stopDiscipline", kind: "check", message: `손절선 도달 후 ${Math.round(delay)}분 보유 — 다시 봐도 진입할 자리였나요?` });
        }
      } else if (p.metrics.status === "closed" && p.metrics.returnPct * 100 <= -p.stopPct - 1 && delay === undefined) {
        // 분봉이 없을 때는 손절폭보다 1%p 이상 더 잃었으면 점검 요청
        r.push({ rule: "stopDiscipline", kind: "check", message: "손절선보다 크게 손실 — 손절이 늦지 않았는지 확인하세요" });
      }
    }
    out.set(p.id, r);
  }
  return out;
}

export type DayState = "open" | "blackout" | "cutoff" | "ended";

export interface DayStatus {
  state: DayState;
  title: string;
  detail: string;
  netKrw: number;
  targetKrw: number;
  bigLoss: PositionView | null;
}

/** 지금 이 순간 매매 가능 여부 (홈 카드) */
export function dayStatus(todays: PositionView[], c: RuleConfig, now = new Date()): DayStatus {
  const closed = todays.filter((p) => p.metrics.status === "closed");
  const netKrw = closed.reduce((a, p) => a + p.krw.net, 0);
  const targetKrw = dailyTargetKrw(c);
  const bigLoss = c.enabled.bigLossStop ? (closed.find((p) => isBigLoss(p, c)) ?? null) : null;
  const base = { netKrw, targetKrw, bigLoss };

  if (bigLoss)
    return { ...base, state: "ended", title: "오늘 매매 종료", detail: `큰 손실 발생 (${bigLoss.ticker} ${(bigLoss.metrics.returnPct * 100).toFixed(1)}%) · 룰 ②` };
  if (c.enabled.dailyTarget && netKrw >= targetKrw)
    return { ...base, state: "ended", title: "오늘 매매 종료", detail: "일일 목표 달성 🎉 · 룰 ④" };
  if (c.enabled.lateCutoff && isAfterCutoff(now, c))
    return { ...base, state: "cutoff", title: "진입 마감", detail: `${isUsSummer(now) ? c.cutoffSummer : c.cutoffWinter} 이후 신규 진입 금지 · 룰 ①` };
  if (c.enabled.openBlackout && isInBlackout(now, c))
    return { ...base, state: "blackout", title: "관망 시간", detail: `${blackoutLabel(now, c)} 진입 금지 · 룰 ③` };
  return { ...base, state: "open", title: "매매 가능", detail: `관망 ${blackoutLabel(now, c)} · 진입 마감 ${isUsSummer(now) ? c.cutoffSummer : c.cutoffWinter}` };
}

export interface CashFlow {
  date: string;
  type: "withdraw" | "deposit";
  amountKrw: number;
}

/** 추정 잔고와 인출 권장액 (룰 ⑤) */
export function withdrawalStatus(positions: PositionView[], flows: CashFlow[], c: RuleConfig) {
  const inRange = (d: string) => !c.capitalStartDate || d >= c.capitalStartDate;
  const pnl = positions.filter((p) => p.metrics.status === "closed" && inRange(p.tradeDate)).reduce((a, p) => a + p.krw.net, 0);
  const flowSum = flows.filter((f) => inRange(f.date)).reduce((a, f) => a + (f.type === "deposit" ? f.amountKrw : -f.amountKrw), 0);
  const balance = c.capitalKrw + pnl + flowSum;
  const trigger = c.capitalKrw * (1 + c.withdrawTriggerPct / 100);
  return { balance, trigger, recommend: c.enabled.withdraw && balance >= trigger ? balance - c.capitalKrw : 0 };
}

/** 룰별 위반 집계 (분석 화면) */
export function ruleSummary(positions: PositionView[], results: Map<number, RuleResult[]>) {
  const closed = positions.filter((p) => p.metrics.status === "closed");
  const rows = RULES.filter((r) => r.id !== "withdraw").map((rule) => {
    const hit = closed.filter((p) => results.get(p.id)?.some((x) => x.rule === rule.id && x.kind === "violation"));
    return { ...rule, count: hit.length, netKrw: hit.reduce((a, p) => a + p.krw.net, 0) };
  });
  const violating = closed.filter((p) => results.get(p.id)?.some((x) => x.kind === "violation"));
  const clean = closed.filter((p) => !results.get(p.id)?.some((x) => x.kind === "violation"));
  return {
    rows,
    total: closed.length,
    compliance: closed.length ? clean.length / closed.length : null,
    violatingNet: violating.reduce((a, p) => a + p.krw.net, 0),
    cleanNet: clean.reduce((a, p) => a + p.krw.net, 0),
    pendingChecks: positions.filter((p) => results.get(p.id)?.some((x) => x.kind === "check")).length,
  };
}
