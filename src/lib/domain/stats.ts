import { ET, KST, etDate, etMinuteOfDay, etWeekday, fmt, localToUtc } from "./time";
import type { PositionView } from "./types";

export interface Bucket {
  key: string;
  label: string;
  count: number;
  wins: number;
  winRate: number;
  netPnl: number;
  avgPnl: number;
}

/** 금액 필드는 모두 원화(KRW) */
export interface Summary {
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number;
  /** 평균 이익 / |평균 손실| */
  payoff: number | null;
  expectancy: number;
  avgR: number | null;
  maxDrawdown: number;
  maxWinStreak: number;
  maxLossStreak: number;
  avgHoldWin: number | null;
  avgHoldLoss: number | null;
  largestWin: number;
  largestLoss: number;
  fees: number;
}

export interface DailyPnl {
  date: string;
  netPnl: number;
  count: number;
  wins: number;
}

export interface ExcursionSummary {
  count: number;
  avgMaeWin: number | null;
  avgMaeLoss: number | null;
  /** 손실로 끝났지만 한때 +0.5% 이상 이익 구간이 있었던 매매 수 */
  lossesThatWereGreen: number;
  /** 이익 매매에서 매도 후 30분 내 추가 상승폭 평균 */
  avgPostExitHighWin: number | null;
  avgCapture: number | null;
  /** 진입 직전 10분에 +2% 이상 오른 상태에서 산 매매 */
  chase: { count: number; winRate: number; avgPnl: number };
}

export interface Stats {
  summary: Summary;
  daily: DailyPnl[];
  equity: { date: string; cum: number }[];
  breakdowns: Record<BreakdownKey, Bucket[]>;
  excursion: ExcursionSummary;
}

export type BreakdownKey =
  | "timeOfDay"
  | "weekday"
  | "holdTime"
  | "setup"
  | "emotion"
  | "tradeNumber"
  | "afterPrev"
  | "confidence"
  | "followedPlan"
  | "ticker";

export const BREAKDOWN_LABELS: Record<BreakdownKey, string> = {
  timeOfDay: "시간대",
  weekday: "요일",
  holdTime: "보유 시간",
  setup: "셋업",
  emotion: "감정/상태",
  tradeNumber: "하루 중 몇 번째 매매",
  afterPrev: "직전 매매 결과",
  confidence: "확신도",
  followedPlan: "계획 준수",
  ticker: "종목",
};

/** 장 개장 기준 시간 구간 (ET 분). 라벨은 표시 시간대로 바꿔 보여준다 */
const TIME_BUCKETS: [number, number, string][] = [
  [0, 570, "프리마켓"],
  [570, 585, "개장 직후"],
  [585, 630, ""],
  [630, 720, ""],
  [720, 840, "점심"],
  [840, 930, ""],
  [930, 960, "마감"],
  [960, 1440, "애프터마켓"],
];

/**
 * 시간 구간 라벨. 구분은 장 개장 기준(ET)이라 서머타임과 무관하게 같은 구간끼리 묶이고,
 * 라벨의 시각만 기준일의 표시 시간대로 환산한다 (예: 한국시간 여름 22:30–22:45 개장 직후).
 */
export function timeBucketLabels(tz: string, ref: Date = new Date()): string[] {
  const day = etDate(ref);
  const hhmm = (min: number) => fmt(localToUtc(day, `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`, ET), tz);
  return TIME_BUCKETS.map(([a, b, name]) => {
    if (a === 0) return `~${hhmm(b)} ${name}`;
    if (b === 1440) return `${hhmm(a)}~ ${name}`;
    return `${hhmm(a)}–${hhmm(b)}${name ? ` ${name}` : ""}`;
  });
}
const WEEKDAYS = ["", "월", "화", "수", "목", "금", "토", "일"];
const HOLD_BUCKETS: [number, string][] = [
  [60, "1분 미만"],
  [180, "1–3분"],
  [600, "3–10분"],
  [1800, "10–30분"],
  [Infinity, "30분 이상"],
];

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function bucketize(list: PositionView[], keyOf: (p: PositionView) => string[] | string | null, order?: string[]): Bucket[] {
  const map = new Map<string, PositionView[]>();
  for (const p of list) {
    const k = keyOf(p);
    const keys = k == null ? [] : Array.isArray(k) ? k : [k];
    for (const key of keys) map.set(key, [...(map.get(key) ?? []), p]);
  }
  const buckets = [...map.entries()].map(([key, ps]) => {
    const pnls = ps.map((p) => p.krw.net);
    const wins = pnls.filter((x) => x > 0).length;
    const net = pnls.reduce((a, b) => a + b, 0);
    return { key, label: key, count: ps.length, wins, winRate: wins / ps.length, netPnl: net, avgPnl: net / ps.length };
  });
  if (order) return buckets.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return buckets.sort((a, b) => b.count - a.count || b.netPnl - a.netPnl);
}

export interface StatsOptions {
  /** 시간대 라벨 표시용 (기본 한국시간) */
  tz?: string;
  /** 라벨 환산 기준일 (서머타임 판단용, 기본 오늘) */
  ref?: Date;
}

export function computeStats(all: PositionView[], opts: StatsOptions = {}): Stats {
  const labels = timeBucketLabels(opts.tz ?? KST, opts.ref);
  const closed = all
    .filter((p) => p.metrics.status === "closed")
    .sort((a, b) => a.metrics.openedAt.getTime() - b.metrics.openedAt.getTime());

  const pnls = closed.map((p) => p.krw.net);
  const winsL = closed.filter((p) => p.krw.net > 0);
  const lossesL = closed.filter((p) => p.krw.net < 0);
  const grossProfit = winsL.reduce((a, p) => a + p.krw.net, 0);
  const grossLoss = lossesL.reduce((a, p) => a + p.krw.net, 0);
  const netPnl = grossProfit + grossLoss;
  const avgWin = winsL.length ? grossProfit / winsL.length : 0;
  const avgLoss = lossesL.length ? grossLoss / lossesL.length : 0;

  let cum = 0;
  let peak = 0;
  let mdd = 0;
  let ws = 0;
  let ls = 0;
  let maxWs = 0;
  let maxLs = 0;
  for (const x of pnls) {
    cum += x;
    peak = Math.max(peak, cum);
    mdd = Math.min(mdd, cum - peak);
    if (x > 0) {
      ws++;
      ls = 0;
    } else if (x < 0) {
      ls++;
      ws = 0;
    }
    maxWs = Math.max(maxWs, ws);
    maxLs = Math.max(maxLs, ls);
  }
  const rs = closed.map((p) => p.metrics.rMultiple).filter((r): r is number => r != null);

  const summary: Summary = {
    count: closed.length,
    wins: winsL.length,
    losses: lossesL.length,
    winRate: closed.length ? winsL.length / closed.length : 0,
    netPnl,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss < 0 ? grossProfit / -grossLoss : null,
    avgWin,
    avgLoss,
    payoff: avgLoss < 0 ? avgWin / -avgLoss : null,
    expectancy: closed.length ? netPnl / closed.length : 0,
    avgR: mean(rs),
    maxDrawdown: mdd,
    maxWinStreak: maxWs,
    maxLossStreak: maxLs,
    avgHoldWin: mean(winsL.map((p) => p.metrics.holdSeconds ?? 0)),
    avgHoldLoss: mean(lossesL.map((p) => p.metrics.holdSeconds ?? 0)),
    largestWin: winsL.length ? Math.max(...winsL.map((p) => p.krw.net)) : 0,
    largestLoss: lossesL.length ? Math.min(...lossesL.map((p) => p.krw.net)) : 0,
    fees: closed.reduce((a, p) => a + p.krw.fees, 0),
  };

  // 일별
  const dayMap = new Map<string, DailyPnl>();
  for (const p of closed) {
    const d = dayMap.get(p.tradeDate) ?? { date: p.tradeDate, netPnl: 0, count: 0, wins: 0 };
    d.netPnl += p.krw.net;
    d.count++;
    if (p.krw.net > 0) d.wins++;
    dayMap.set(p.tradeDate, d);
  }
  const daily = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  let c = 0;
  const equity = daily.map((d) => ({ date: d.date, cum: (c += d.netPnl) }));

  // 하루 중 순번 및 직전 매매 결과
  const tradeNo = new Map<number, number>();
  const afterPrev = new Map<number, string>();
  const byDay = new Map<string, PositionView[]>();
  for (const p of closed) byDay.set(p.tradeDate, [...(byDay.get(p.tradeDate) ?? []), p]);
  for (const ps of byDay.values()) {
    ps.forEach((p, i) => {
      tradeNo.set(p.id, i + 1);
      if (i === 0) return afterPrev.set(p.id, "그날 첫 매매");
      const prev = ps[i - 1];
      const gapMin = prev.metrics.closedAt
        ? (p.metrics.openedAt.getTime() - prev.metrics.closedAt.getTime()) / 60000
        : Infinity;
      const quick = gapMin <= 15;
      const res = prev.metrics.netPnl < 0 ? "손실" : "이익";
      afterPrev.set(p.id, quick ? `${res} 직후 15분 내 재진입` : `${res} 후 15분 이상 쉬고 진입`);
    });
  }

  const holdLabel = (s: number | null) => HOLD_BUCKETS.find(([lim]) => (s ?? 0) < lim)![1];
  const timeLabel = (p: PositionView) => {
    const m = etMinuteOfDay(p.metrics.openedAt);
    return labels[TIME_BUCKETS.findIndex(([a, b]) => m >= a && m < b)];
  };

  const breakdowns: Record<BreakdownKey, Bucket[]> = {
    timeOfDay: bucketize(closed, timeLabel, labels),
    weekday: bucketize(closed, (p) => WEEKDAYS[etWeekday(p.metrics.openedAt)], WEEKDAYS),
    holdTime: bucketize(closed, (p) => holdLabel(p.metrics.holdSeconds), HOLD_BUCKETS.map((b) => b[1])),
    setup: bucketize(closed, (p) => (p.setupTags.length ? p.setupTags : ["(태그 없음)"])),
    emotion: bucketize(closed, (p) => (p.emotionTags.length ? p.emotionTags : ["(태그 없음)"])),
    tradeNumber: bucketize(
      closed,
      (p) => {
        const n = tradeNo.get(p.id)!;
        return n >= 6 ? "6번째 이후" : `${n}번째`;
      },
      ["1번째", "2번째", "3번째", "4번째", "5번째", "6번째 이후"],
    ),
    afterPrev: bucketize(closed, (p) => afterPrev.get(p.id) ?? null, [
      "그날 첫 매매",
      "이익 직후 15분 내 재진입",
      "이익 후 15분 이상 쉬고 진입",
      "손실 직후 15분 내 재진입",
      "손실 후 15분 이상 쉬고 진입",
    ]),
    confidence: bucketize(closed, (p) => (p.confidence ? `확신 ${p.confidence}` : null), [1, 2, 3, 4, 5].map((n) => `확신 ${n}`)),
    followedPlan: bucketize(
      closed,
      (p) => (p.followedPlan == null ? null : p.followedPlan ? "계획대로" : "계획 이탈"),
      ["계획대로", "계획 이탈"],
    ),
    ticker: bucketize(closed, (p) => p.ticker).slice(0, 15),
  };

  // 분봉 기반
  const withEx = closed.filter((p) => p.excursion);
  const exW = withEx.filter((p) => p.krw.net > 0);
  const exL = withEx.filter((p) => p.krw.net < 0);
  const chase = withEx.filter((p) => (p.excursion!.preEntryChangePct ?? 0) >= 0.02);
  const excursion: ExcursionSummary = {
    count: withEx.length,
    avgMaeWin: mean(exW.map((p) => p.excursion!.maePct)),
    avgMaeLoss: mean(exL.map((p) => p.excursion!.maePct)),
    lossesThatWereGreen: exL.filter((p) => p.excursion!.mfePct >= 0.005).length,
    avgPostExitHighWin: mean(
      exW.map((p) => p.excursion!.postExitHighPct).filter((x): x is number => x != null),
    ),
    avgCapture: mean(withEx.map((p) => p.excursion!.captureRatio).filter((x): x is number => x != null)),
    chase: {
      count: chase.length,
      winRate: chase.length ? chase.filter((p) => p.krw.net > 0).length / chase.length : 0,
      avgPnl: mean(chase.map((p) => p.krw.net)) ?? 0,
    },
  };

  return { summary, daily, equity, breakdowns, excursion };
}
