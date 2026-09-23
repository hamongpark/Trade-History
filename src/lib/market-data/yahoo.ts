import type { Bar } from "../domain/types";
import { MarketDataError, type MarketDataProvider } from "./types";

/** API 키 없이 쓸 수 있지만 비공식이며 1분봉은 최근 약 30일만 제공된다. */
export const yahooProvider: MarketDataProvider = {
  id: "yahoo",
  label: "Yahoo Finance (무료, 최근 30일)",
  isConfigured: () => true,
  async fetchMinuteBars(ticker, from, to) {
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`);
    url.searchParams.set("interval", "1m");
    url.searchParams.set("includePrePost", "true");
    url.searchParams.set("period1", String(Math.floor(from.getTime() / 1000)));
    url.searchParams.set("period2", String(Math.ceil(to.getTime() / 1000)));
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) throw new MarketDataError(`Yahoo 응답 오류 ${res.status}`, "yahoo", res.status);
    const json = await res.json();
    const r = json?.chart?.result?.[0];
    if (!r) throw new MarketDataError(json?.chart?.error?.description ?? "Yahoo 데이터 없음", "yahoo");
    const ts: number[] = r.timestamp ?? [];
    const q = r.indicators?.quote?.[0] ?? {};
    const bars: Bar[] = [];
    ts.forEach((t, i) => {
      const [o, h, l, c, v] = [q.open?.[i], q.high?.[i], q.low?.[i], q.close?.[i], q.volume?.[i]];
      if (o == null || h == null || l == null || c == null) return;
      bars.push({ ts: new Date(t * 1000), open: o, high: h, low: l, close: c, volume: v ?? 0 });
    });
    return bars;
  },
};
