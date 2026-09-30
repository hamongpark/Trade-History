/** 환율 API 없이 쓸 기본값 (조회 실패 + 캐시도 없을 때만 사용) */
export const FALLBACK_USD_KRW = 1400;

/** Frankfurter(ECB 기준환율) 응답에서 KRW 환율 추출 */
export function parseFrankfurter(json: unknown): { rate: number; rateDate: string } | null {
  const j = json as { date?: string; rates?: { KRW?: number } } | null;
  const rate = j?.rates?.KRW;
  if (!j?.date || typeof rate !== "number" || !(rate > 0)) return null;
  return { rate, rateDate: j.date };
}

/** 원화 환산 (원 단위 반올림 없이 계산, 표시할 때 반올림) */
export function toKrw(usd: number, rate: number): number {
  return usd * rate;
}
