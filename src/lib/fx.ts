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

async function fetchFrankfurter(date: string) {
  const urls = [
    `https://api.frankfurter.dev/v1/${date}?base=USD&symbols=KRW`,
    `https://api.frankfurter.app/${date}?from=USD&to=KRW`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const parsed = parseFrankfurter(await res.json());
      if (parsed) return parsed;
    } catch {
      // 다음 주소 시도
    }
  }
  return null;
}

/**
 * 거래일(YYYY-MM-DD)의 USD/KRW 기준환율 (ECB, Frankfurter).
 * 주말·휴일이나 아직 고시 전이면 직전 영업일 환율. 확정된 값만 캐시한다.
 */
export async function getUsdKrw(date: string): Promise<FxQuote> {
  const db = await getDb();
  const [cached] = await db.select().from(schema.fxRates).where(eq(schema.fxRates.date, date));
  if (cached) return { rate: cached.rate, rateDate: cached.rateDate, source: cached.source, provisional: false };

  const fetched = await fetchFrankfurter(date);
  if (fetched) {
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
