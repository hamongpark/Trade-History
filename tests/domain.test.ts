import { describe, expect, it } from "vitest";
import { computeExcursion } from "@/lib/domain/excursion";
import { buildView, computeMetrics, groupIntoPositions, pctToPrices } from "@/lib/domain/position";
import { computeStats } from "@/lib/domain/stats";
import { deriveInsights } from "@/lib/domain/insights";
import { etDate, localToUtc } from "@/lib/domain/time";
import type { Bar, Execution, PositionView } from "@/lib/domain/types";

const at = (hhmm: string, date = "2026-09-22") => localToUtc(date, hhmm, "America/New_York");
const ex = (side: "buy" | "sell", hhmm: string, price: number, qty: number, fee = 0): Execution => ({
  side,
  executedAt: at(hhmm),
  price,
  qty,
  fee,
});

describe("time", () => {
  it("KST 밤 거래를 ET 거래일로 변환", () => {
    // 2026-09-22 22:35 KST = 2026-09-22 09:35 EDT
    const d = localToUtc("2026-09-22", "22:35", "Asia/Seoul");
    expect(d.toISOString()).toBe("2026-09-22T13:35:00.000Z");
    expect(etDate(d)).toBe("2026-09-22");
    // 다음날 새벽 01:10 KST 도 같은 ET 거래일
    expect(etDate(localToUtc("2026-09-23", "01:10", "Asia/Seoul"))).toBe("2026-09-22");
  });
});

describe("computeMetrics", () => {
  it("단순 매수→매도", () => {
    const m = computeMetrics([ex("buy", "09:35", 10, 100, 1), ex("sell", "09:40", 10.5, 100, 1)], 2); // 손절율 2% = $0.2/주
    expect(m.status).toBe("closed");
    expect(m.grossPnl).toBeCloseTo(50);
    expect(m.netPnl).toBeCloseTo(48);
    expect(m.holdSeconds).toBe(300);
    expect(m.rMultiple).toBeCloseTo(48 / 20);
    expect(m.returnPct).toBeCloseTo(0.048);
  });

  it("분할 매수·분할 매도 평균단가", () => {
    const m = computeMetrics([
      ex("buy", "09:35", 10, 100),
      ex("buy", "09:36", 11, 100),
      ex("sell", "09:40", 12, 50),
      ex("sell", "09:45", 10, 150),
    ]);
    // 평균 10.5, (12-10.5)*50 + (10-10.5)*150 = 75 - 75 = 0
    expect(m.avgEntry).toBeCloseTo(10.5);
    expect(m.grossPnl).toBeCloseTo(0);
    expect(m.maxQty).toBe(200);
    expect(m.closedAt?.getTime()).toBe(at("09:45").getTime());
  });

  it("미청산 포지션", () => {
    const m = computeMetrics([ex("buy", "09:35", 10, 100), ex("sell", "09:40", 11, 40)]);
    expect(m.status).toBe("open");
    expect(m.openQty).toBe(60);
    expect(m.closedAt).toBeNull();
  });
});

describe("groupIntoPositions", () => {
  it("종목별로 수량 0 기준 포지션 분리 + 고아 매도", () => {
    const list = [
      { ticker: "aapl", ...ex("buy", "09:31", 1, 10) },
      { ticker: "AAPL", ...ex("sell", "09:33", 1.1, 10) },
      { ticker: "AAPL", ...ex("buy", "09:50", 1, 5) },
      { ticker: "TSLA", ...ex("sell", "09:40", 2, 5) },
      { ticker: "AAPL", ...ex("sell", "09:55", 1, 5) },
    ];
    const r = groupIntoPositions(list);
    expect(r.groups.map((g) => [g.ticker, g.executions.length])).toEqual([
      ["AAPL", 2],
      ["AAPL", 2],
    ]);
    expect(r.orphans).toHaveLength(1);
  });
});

describe("excursion", () => {
  it("MAE/MFE/매도 후 흐름", () => {
    const m = computeMetrics([ex("buy", "09:35", 10, 100), ex("sell", "09:37", 10.2, 100)]);
    const bars: Bar[] = [];
    const path: [string, number, number][] = [
      ["09:25", 9.5, 9.6], ["09:34", 9.8, 9.9],
      ["09:35", 9.9, 10.1], ["09:36", 9.7, 10.3], ["09:37", 10.0, 10.2],
      ["09:40", 10.2, 10.8],
    ];
    for (const [t, lo, hi] of path) bars.push({ ts: at(t), open: lo, high: hi, low: lo, close: hi, volume: 1 });
    const e = computeExcursion(bars, m)!;
    expect(e.maePct).toBeCloseTo(-0.03);
    expect(e.mfePct).toBeCloseTo(0.03);
    expect(e.postExitHighPct).toBeCloseTo(0.6 / 10.2);
    expect(e.preEntryChangePct).toBeCloseTo((10 - 9.5) / 9.5);
    expect(e.captureRatio).toBeCloseTo(20 / 30);
  });
});

describe("stats", () => {
  const mk = (id: number, date: string, open: string, close: string, pnlPerShare: number, tags: string[] = []): PositionView => {
    const executions = [
      { side: "buy" as const, executedAt: at(open, date), price: 10, qty: 10, fee: 0 },
      { side: "sell" as const, executedAt: at(close, date), price: 10 + pnlPerShare, qty: 10, fee: 0 },
    ];
    return buildView({
      id, ticker: "AAPL", tradeDate: date, openedAt: executions[0].executedAt, closedAt: executions[1].executedAt,
      stopPct: null, targetPct: null, fxRate: 1, fxProvisional: false, setupTags: tags, emotionTags: [], confidence: null,
      followedPlan: null, entryReason: "", exitReason: "", note: "", candlesStatus: "none", candlesError: null, excursion: null,
      executions,
    });
  };
  const list = [
    mk(1, "2026-09-21", "09:31", "09:33", 1, ["돌파"]),
    mk(2, "2026-09-21", "09:40", "09:55", -2, ["눌림목"]),
    mk(3, "2026-09-21", "09:57", "10:20", -1, ["눌림목"]),
    mk(4, "2026-09-22", "09:31", "09:32", 1.5, ["돌파"]),
    mk(5, "2026-09-22", "10:00", "10:02", 0.5, ["돌파"]),
    mk(6, "2026-09-22", "10:10", "10:40", -1, ["눌림목"]),
  ];
  const s = computeStats(list);

  it("요약 지표", () => {
    expect(s.summary.count).toBe(6);
    expect(s.summary.winRate).toBeCloseTo(0.5);
    expect(s.summary.netPnl).toBeCloseTo(-10);
    expect(s.summary.profitFactor).toBeCloseTo(30 / 40);
    expect(s.summary.maxDrawdown).toBeCloseTo(-30);
    expect(s.daily).toEqual([
      { date: "2026-09-21", netPnl: -20, count: 3, wins: 1 },
      { date: "2026-09-22", netPnl: 10, count: 3, wins: 2 },
    ]);
  });

  it("분해 분석", () => {
    const after = Object.fromEntries(s.breakdowns.afterPrev.map((b) => [b.key, b.count]));
    expect(after["그날 첫 매매"]).toBe(2);
    expect(after["손실 직후 15분 내 재진입"]).toBe(1);
    expect(s.breakdowns.setup.find((b) => b.key === "돌파")?.netPnl).toBeCloseTo(30);
  });

  it("인사이트", () => {
    const titles = deriveInsights(s).map((i) => i.title);
    expect(titles).toContain("손실 포지션을 오래 버팀");
    expect(titles).toContain("손익비가 낮음");
  });
});

describe("원화 환산 · 손절율", () => {
  it("환율을 곱해 원화 손익, 손절율로 R 과 가격 계산", () => {
    const executions = [ex("buy", "09:35", 10, 100, 1), ex("sell", "09:40", 10.5, 100, 1)];
    const v = buildView({
      id: 1, ticker: "AAPL", tradeDate: "2026-09-22", openedAt: executions[0].executedAt, closedAt: executions[1].executedAt,
      stopPct: 2, targetPct: 5, fxRate: 1390, fxProvisional: false, setupTags: [], emotionTags: [], confidence: null,
      followedPlan: null, entryReason: "", exitReason: "", note: "", candlesStatus: "none", candlesError: null, excursion: null,
      executions,
    });
    expect(v.krw.net).toBeCloseTo(48 * 1390);
    expect(v.krw.fees).toBeCloseTo(2 * 1390);
    expect(v.metrics.rMultiple).toBeCloseTo(48 / 20);
    expect(v.stopPrice).toBeCloseTo(9.8);
    expect(v.targetPrice).toBeCloseTo(10.5);
    expect(pctToPrices(10, null, null)).toEqual({ stopPrice: null, targetPrice: null });
  });
});
