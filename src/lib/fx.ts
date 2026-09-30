import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { FALLBACK_USD_KRW, parseFrankfurter } from "./domain/fx";
import { addDays, etDate } from "./domain/time";

export interface FxQuote {
  rate: number;
  /** 실제 적용된 기준일 */
  rateDate: string;
  source: string;
  /** 조회 실패로 임시값을 쓴 경우 (포지션에 저장하지 않음) */
  provisional: boolean;
}

const TIMEOUT_MS = 2500;
/** 조회 실패한 날짜는 잠시 다시 묻지 않는다 (화면이 매번 느려지지 않도록) */
const RETRY_AFTER_MS = 10 * 60_000;
const failedAt = new Map<string, number>();

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = parseFrankfurter(await res.json());
  if (!parsed) throw new Error("환율 응답 형식 오류");
  return parsed;
}

/** 두 주소를 동시에 조회해 먼저 성공한 값을 쓴다 (최대 2.5초) */
async function fetchFrankfurter(date: string) {
  try {
    return await Promise.any([
      fetchJson(`https://api.frankfurter.dev/v1/${date}?base=USD&symbols=KRW`),
      fetchJson(`https://api.frankfurter.app/${date}?from=USD&to=KRW`),
    ]);
  } catch {
    return null;
  }
}

/**
 * 거래일(YYYY-MM-DD)의 USD/KRW 기준환율 (ECB, Frankfurter).
 * 주말·휴일이나 아직 고시 전이면 직전 영업일 환율. 확정된 값만 캐시한다.
 */
export async function getUsdKrw(date: string): Promise<FxQuote> {
  const db = await getDb();
  const [cached] = await db.select().from(schema.fxRates).where(eq(schema.fxRates.date, date));
  if (cached) return { rate: cached.rate, rateDate: cached.rateDate, source: cached.source, provisional: false };

  const failed = failedAt.get(date);
  const fetched = failed && Date.now() - failed < RETRY_AFTER_MS ? null : await fetchFrankfurter(date);
  if (!fetched) failedAt.set(date, failed ?? Date.now());
  if (fetched) {
    failedAt.delete(date);
    // 요청일 환율이 이미 나왔거나, 충분히 지난 날짜(주말·휴일)면 확정으로 보고 캐시
    const settled = fetched.rateDate === date || date < addDays(etDate(new Date()), -3);
    if (settled)
      await db
        .insert(schema.fxRates)
        .values({ date, rate: fetched.rate, rateDate: fetched.rateDate, source: "ecb" })
        .onConflictDoNothing();
    return { rate: fetched.rate, rateDate: fetched.rateDate, source: "ecb", provisional: false };
  }

  const [latest] = await db.select().from(schema.fxRates).orderBy(desc(schema.fxRates.date)).limit(1);
  if (latest) return { rate: latest.rate, rateDate: latest.rateDate, source: "cache", provisional: true };
  return { rate: FALLBACK_USD_KRW, rateDate: date, source: "fallback", provisional: true };
}
