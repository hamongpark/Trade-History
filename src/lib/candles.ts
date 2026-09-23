import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "./db";
import { computeExcursion } from "./domain/excursion";
import type { Bar, PositionView } from "./domain/types";
import { activeProviders } from "./market-data";
import { getPosition, setCandleState } from "./repo/positions";

/** 체결 앞뒤로 보여줄 분 */
export const WINDOW_MINUTES = 30;
const MIN = 60_000;

export function candleWindow(p: PositionView): { from: Date; to: Date } {
  const first = p.metrics.openedAt.getTime();
  const last = Math.max(...p.executions.map((e) => e.executedAt.getTime()));
  return { from: new Date(first - WINDOW_MINUTES * MIN), to: new Date(last + (WINDOW_MINUTES + 1) * MIN) };
}

export async function loadCandles(ticker: string, from: Date, to: Date): Promise<Bar[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.candles)
    .where(and(eq(schema.candles.ticker, ticker), gte(schema.candles.ts, from), lte(schema.candles.ts, to)))
    .orderBy(asc(schema.candles.ts));
  return rows.map(({ ts, open, high, low, close, volume }) => ({ ts, open, high, low, close, volume }));
}

/**
 * 포지션 구간의 분봉을 공급자에서 받아 캐시에 저장하고 MAE/MFE 등을 갱신한다.
 * 실패해도 예외를 던지지 않고 상태만 기록한다 (기록 저장이 막히지 않도록).
 */
export async function refreshCandles(positionId: number): Promise<{ ok: boolean; error?: string; count?: number }> {
  const p = await getPosition(positionId);
  if (!p) return { ok: false, error: "포지션 없음" };
  const { from, to } = candleWindow(p);
  const providers = activeProviders();
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const bars = (await provider.fetchMinuteBars(p.ticker, from, to, { fills: p.executions.map((e) => ({ t: e.executedAt, price: e.price })) })).filter(
        (b) => b.ts >= from && b.ts <= to,
      );
      if (bars.length === 0) {
        errors.push(`${provider.id}: 데이터 없음`);
        continue;
      }
      const db = await getDb();
      for (let i = 0; i < bars.length; i += 500) {
        const chunk = bars.slice(i, i + 500).map((b) => ({ ...b, ticker: p.ticker, source: provider.id }));
        await db
          .insert(schema.candles)
          .values(chunk)
          .onConflictDoNothing();
      }
      const cached = await loadCandles(p.ticker, from, to);
      await setCandleState(p.id, "ok", null, computeExcursion(cached, p.metrics));
      return { ok: true, count: bars.length };
    } catch (e) {
      errors.push(`${provider.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const error = errors.join(" / ") || "설정된 분봉 공급자가 없습니다";
  await setCandleState(p.id, "error", error, null);
  return { ok: false, error };
}

/** 분봉 fetch 가 너무 오래 걸려도 저장 응답이 늦어지지 않도록 제한 시간을 둔다 */
export async function refreshCandlesWithTimeout(positionId: number, ms = 8000) {
  return Promise.race([
    refreshCandles(positionId),
    new Promise<{ ok: false; error: string }>((r) => setTimeout(() => r({ ok: false, error: "timeout" }), ms)),
  ]);
}
