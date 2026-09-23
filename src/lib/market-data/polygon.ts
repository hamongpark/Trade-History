import type { Bar } from "../domain/types";
import { MarketDataError, type MarketDataProvider } from "./types";

/** Polygon(Massive) Aggregates API. 무료 키는 분당 5회, 최근 2년 분봉. */
export const polygonProvider: MarketDataProvider = {
  id: "polygon",
  label: "Polygon (무료 키, 최근 2년)",
  isConfigured: () => Boolean(process.env.POLYGON_API_KEY),
  async fetchMinuteBars(ticker, from, to) {
    const base = process.env.POLYGON_BASE_URL ?? "https://api.polygon.io";
    const url = new URL(`${base}/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/minute/${from.getTime()}/${to.getTime()}`);
    url.searchParams.set("adjusted", "false");
    url.searchParams.set("sort", "asc");
    url.searchParams.set("limit", "50000");
    url.searchParams.set("apiKey", process.env.POLYGON_API_KEY!);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new MarketDataError(`Polygon 응답 오류 ${res.status}`, "polygon", res.status);
    const json = await res.json();
    return (json.results ?? []).map(
      (b: { t: number; o: number; h: number; l: number; c: number; v: number }): Bar => ({
        ts: new Date(b.t),
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
      }),
    );
  },
};
