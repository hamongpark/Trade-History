import type { Bar } from "../domain/types";
import { MarketDataError, type MarketDataProvider } from "./types";

/**
 * Alpaca Market Data (무료 계정 API 키 필요).
 * 무료 플랜에서도 15분 이전의 과거 1분봉을 수년치 조회할 수 있어 기본 추천 공급자.
 * ALPACA_FEED=sip(전체 거래소, 기본) | iex
 */
export const alpacaProvider: MarketDataProvider = {
  id: "alpaca",
  label: "Alpaca (무료 키, 과거 분봉 수년치)",
  isConfigured: () => Boolean(process.env.ALPACA_API_KEY_ID && process.env.ALPACA_API_SECRET_KEY),
  async fetchMinuteBars(ticker, from, to) {
    const feeds = [process.env.ALPACA_FEED ?? "sip", "iex"];
    let lastErr: MarketDataError | null = null;
    for (const feed of [...new Set(feeds)]) {
      try {
        return await fetchFeed(ticker, from, to, feed);
      } catch (e) {
        if (!(e instanceof MarketDataError) || (e.status !== 403 && e.status !== 422)) throw e;
        lastErr = e;
      }
    }
    throw lastErr!;
  },
};

async function fetchFeed(ticker: string, from: Date, to: Date, feed: string): Promise<Bar[]> {
  const bars: Bar[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(ticker)}/bars`);
    url.searchParams.set("timeframe", "1Min");
    url.searchParams.set("start", from.toISOString());
    url.searchParams.set("end", to.toISOString());
    url.searchParams.set("adjustment", "raw");
    url.searchParams.set("feed", feed);
    url.searchParams.set("limit", "10000");
    if (pageToken) url.searchParams.set("page_token", pageToken);
    const res = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": process.env.ALPACA_API_KEY_ID!,
        "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET_KEY!,
      },
      cache: "no-store",
    });
    if (!res.ok) throw new MarketDataError(`Alpaca(${feed}) 응답 오류 ${res.status}: ${await res.text()}`, "alpaca", res.status);
    const json = await res.json();
    for (const b of json.bars ?? []) bars.push({ ts: new Date(b.t), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v });
    pageToken = json.next_page_token ?? undefined;
  } while (pageToken);
  return bars;
}
