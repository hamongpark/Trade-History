import type { Bar, Excursion, PositionMetrics } from "./types";

const MIN = 60_000;

/** 분봉과 포지션 지표로 MAE/MFE, 매도 후 흐름, 진입 전 흐름을 계산한다. */
export function computeExcursion(
  bars: Bar[],
  m: PositionMetrics,
  stopPrice: number | null = null,
  postMinutes = 30,
  preMinutes = 10,
): Excursion | null {
  if (bars.length === 0 || m.avgEntry <= 0) return null;
  const sorted = [...bars].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  const floorMin = (d: Date) => Math.floor(d.getTime() / MIN) * MIN;
  const start = floorMin(m.openedAt);
  const end = m.closedAt ? floorMin(m.closedAt) : sorted[sorted.length - 1].ts.getTime();

  const hold = sorted.filter((b) => b.ts.getTime() >= start && b.ts.getTime() <= end);
  if (hold.length === 0) return null;
  const hi = Math.max(...hold.map((b) => b.high));
  const lo = Math.min(...hold.map((b) => b.low));
  const maePct = Math.min(0, (lo - m.avgEntry) / m.avgEntry);
  const mfePct = Math.max(0, (hi - m.avgEntry) / m.avgEntry);

  let postExitHighPct: number | null = null;
  let postExitLowPct: number | null = null;
  if (m.closedAt && m.avgExit) {
    const post = sorted.filter((b) => b.ts.getTime() > end && b.ts.getTime() <= end + postMinutes * MIN);
    if (post.length) {
      postExitHighPct = (Math.max(...post.map((b) => b.high)) - m.avgExit) / m.avgExit;
      postExitLowPct = (Math.min(...post.map((b) => b.low)) - m.avgExit) / m.avgExit;
    }
  }

  let preEntryChangePct: number | null = null;
  const pre = sorted.filter((b) => b.ts.getTime() >= start - preMinutes * MIN && b.ts.getTime() < start);
  if (pre.length) preEntryChangePct = (m.avgEntry - pre[0].open) / pre[0].open;

  let stopHitDelayMin: number | null = null;
  if (stopPrice != null) {
    const hit = hold.find((b) => b.low <= stopPrice);
    if (hit) stopHitDelayMin = Math.max(0, (end - hit.ts.getTime()) / MIN);
  }

  const mfeUsd = (hi - m.avgEntry) * m.maxQty;
  return {
    maePct,
    mfePct,
    maeUsd: maePct * m.avgEntry * m.maxQty,
    mfeUsd: Math.max(0, mfeUsd),
    postExitHighPct,
    postExitLowPct,
    preEntryChangePct,
    captureRatio: m.status === "closed" && m.grossPnl > 0 && mfeUsd > 0 ? Math.min(1, m.grossPnl / mfeUsd) : null,
    barsInHold: hold.length,
    stopHitDelayMin,
  };
}
