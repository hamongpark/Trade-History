import type { Bar } from "../domain/types";
import type { MarketDataProvider } from "./types";

/**
 * 데모/개발용 가짜 분봉. MARKET_DATA_PROVIDER=mock 일 때만 사용된다.
 * 체결가를 지나가도록 선형 보간 + 결정적 노이즈로 만든다.
 */
export const mockProvider: MarketDataProvider = {
  id: "mock",
  label: "Mock (데모용 가짜 데이터)",
  isConfigured: () => false,
  async fetchMinuteBars(ticker, from, to, hint) {
    const fills = [...(hint?.fills ?? [])].sort((a, b) => a.t.getTime() - b.t.getTime());
    const base = fills[0]?.price ?? 50;
    let seed = [...ticker].reduce((a, c) => a * 31 + c.charCodeAt(0), from.getTime() / 60000) % 2147483647;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
    const anchor = (t: number) => {
      if (!fills.length) return base;
      if (t <= fills[0].t.getTime()) return fills[0].price * (1 - (fills[0].t.getTime() - t) / 3.6e6 * 0.02);
      const last = fills[fills.length - 1];
      if (t >= last.t.getTime()) return last.price * (1 + (t - last.t.getTime()) / 3.6e6 * 0.03);
      const i = fills.findIndex((f) => f.t.getTime() > t);
      const a = fills[i - 1];
      const b = fills[i];
      const k = (t - a.t.getTime()) / (b.t.getTime() - a.t.getTime() || 1);
      return a.price + (b.price - a.price) * k;
    };
    const bars: Bar[] = [];
    let prevClose = anchor(from.getTime());
    for (let t = Math.floor(from.getTime() / 60000) * 60000; t <= to.getTime(); t += 60000) {
      const target = anchor(t + 30000) * (1 + rand() * 0.004);
      const open = prevClose;
      const close = target;
      const high = Math.max(open, close) * (1 + Math.abs(rand()) * 0.003);
      const low = Math.min(open, close) * (1 - Math.abs(rand()) * 0.003);
      bars.push({ ts: new Date(t), open: +open.toFixed(3), high: +high.toFixed(3), low: +low.toFixed(3), close: +close.toFixed(3), volume: Math.round(20000 + Math.abs(rand()) * 80000) });
      prevClose = close;
    }
    return bars;
  },
};
