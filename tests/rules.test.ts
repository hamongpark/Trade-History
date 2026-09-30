import { describe, expect, it } from "vitest";
import { buildView } from "@/lib/domain/position";
import { DEFAULT_RULES, blackoutLabel, dayStatus, evaluateRules, isAfterCutoff, isInBlackout, ruleSummary, withdrawalStatus } from "@/lib/domain/rules";
import { etDate, localToUtc } from "@/lib/domain/time";
import type { Execution, PositionView } from "@/lib/domain/types";

const KST = "Asia/Seoul";
const at = (date: string, hhmm: string) => localToUtc(date, hhmm, KST);
const c = DEFAULT_RULES;

/** 한국시간으로 매매 1건 (환율 1000원, 1000주 → $1 = 100만원) */
function trade(id: number, date: string, open: string, close: string, entry: number, exit: number, extra: Partial<PositionView> = {}, buys?: Execution[]): PositionView {
  const o = at(date, open);
  const cl = at(close < open ? nextDay(date) : date, close);
  const executions: Execution[] = buys ?? [{ side: "buy", executedAt: o, price: entry, qty: 1000, fee: 0 }];
  const qty = executions.filter((e) => e.side === "buy").reduce((a, e) => a + e.qty, 0);
  executions.push({ side: "sell", executedAt: cl, price: exit, qty, fee: 0 });
  const v = buildView({
    id, ticker: "TGE", tradeDate: etDate(o), openedAt: o, closedAt: cl, stopPct: 10, targetPct: 3, fxRate: 100,
    fxProvisional: false, setupTags: [], emotionTags: [], confidence: null, followedPlan: null, wouldReenter: null,
    entryReason: "", exitReason: "", note: "", candlesStatus: "ok", candlesError: null, excursion: null, executions,
  });
  return { ...v, ...extra };
}
function nextDay(d: string) {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}

describe("시간 룰", () => {
  it("① 진입 마감: 여름 00:00, 겨울 00:30", () => {
    expect(isAfterCutoff(at("2026-09-30", "23:59"), c)).toBe(false);
    expect(isAfterCutoff(at("2026-10-01", "00:10"), c)).toBe(true);
    expect(isAfterCutoff(at("2026-12-16", "00:10"), c)).toBe(false);
    expect(isAfterCutoff(at("2026-12-16", "00:40"), c)).toBe(true);
    expect(isAfterCutoff(at("2026-10-01", "18:00"), c)).toBe(false);
  });
  it("③ 개장 10분 전 ~ 3분 후", () => {
    expect(isInBlackout(at("2026-09-30", "22:19"), c)).toBe(false);
    expect(isInBlackout(at("2026-09-30", "22:20"), c)).toBe(true);
    expect(isInBlackout(at("2026-09-30", "22:32"), c)).toBe(true);
    expect(isInBlackout(at("2026-09-30", "22:33"), c)).toBe(false);
    expect(isInBlackout(at("2026-12-15", "23:25"), c)).toBe(true);
    expect(blackoutLabel(at("2026-09-30", "20:00"), c)).toBe("22:20–22:33");
    expect(blackoutLabel(at("2026-12-15", "20:00"), c)).toBe("23:20–23:33");
  });
});

describe("evaluateRules", () => {
  it("② 큰 손실 후 매매는 위반, 작은 손실은 무관", () => {
    const a = trade(1, "2026-09-30", "22:40", "22:45", 2.0, 1.88); // −6%
    const b = trade(2, "2026-09-30", "22:50", "22:52", 2.0, 2.06);
    const r = evaluateRules([a, b], c);
    expect(r.get(1)).toEqual([]);
    expect(r.get(2)?.map((x) => x.rule)).toEqual(["bigLossStop"]);

    const small = trade(3, "2026-09-30", "22:40", "22:45", 2.0, 1.94); // −3%
    const after = trade(4, "2026-09-30", "22:50", "22:52", 2.0, 2.06);
    expect(evaluateRules([small, after], c).get(4)).toEqual([]);
  });

  it("④ 목표 달성 후 매매는 위반 (목표 10만원)", () => {
    const a = trade(1, "2026-09-30", "22:40", "22:45", 2.0, 2.6); // +600원×... = 1000주×$0.6×100 = +60,000원
    const b = trade(2, "2026-09-30", "22:50", "22:55", 2.0, 2.5); // +50,000원 → 누적 110,000
    const d = trade(3, "2026-09-30", "23:00", "23:02", 2.0, 2.1);
    const r = evaluateRules([a, b, d], c);
    expect(r.get(2)).toEqual([]);
    expect(r.get(3)?.map((x) => x.rule)).toEqual(["dailyTarget"]);
    expect(dayStatus([a, b], c, at("2026-09-30", "23:10")).state).toBe("ended");
  });

  it("⑦ 추가 매수: 같은 1분 안은 예외, 이후 낮은 가격은 물타기", () => {
    const o = at("2026-09-30", "22:40");
    const split = trade(1, "2026-09-30", "22:40", "22:45", 2, 2.06, {}, [
      { side: "buy", executedAt: o, price: 2, qty: 500, fee: 0 },
      { side: "buy", executedAt: new Date(o.getTime() + 20_000), price: 2.01, qty: 500, fee: 0 },
    ]);
    const avgDown = trade(2, "2026-09-30", "22:50", "22:58", 2, 2.06, {}, [
      { side: "buy", executedAt: at("2026-09-30", "22:50"), price: 2, qty: 500, fee: 0 },
      { side: "buy", executedAt: at("2026-09-30", "22:53"), price: 1.9, qty: 500, fee: 0 },
    ]);
    const r = evaluateRules([split, avgDown], c);
    expect(r.get(1)).toEqual([]);
    expect(r.get(2)?.[0]).toMatchObject({ rule: "noAdding", message: "추가 매수 1회 (물타기)" });
  });

  it("⑥ 손절선 도달 후 버팀: 자가 체크에 따라 판정", () => {
    const ex = { maePct: -0.12, mfePct: 0, maeUsd: 0, mfeUsd: 0, postExitHighPct: null, postExitLowPct: null, preEntryChangePct: null, captureRatio: null, barsInHold: 8, stopHitDelayMin: 5 };
    const base = trade(1, "2026-09-30", "22:40", "22:48", 2, 1.76, { excursion: ex });
    expect(evaluateRules([base], c).get(1)?.[0]).toMatchObject({ rule: "stopDiscipline", kind: "check" });
    expect(evaluateRules([{ ...base, wouldReenter: false }], c).get(1)?.[0]).toMatchObject({ kind: "violation" });
    expect(evaluateRules([{ ...base, wouldReenter: true }], c).get(1)).toEqual([]);
  });

  it("①③ 진입 시각 위반과 요약", () => {
    const late = trade(1, "2026-10-01", "00:10", "00:15", 2, 2.06);
    const early = trade(2, "2026-09-30", "22:25", "22:30", 2, 1.97);
    const r = evaluateRules([late, early], c);
    expect(r.get(1)?.map((x) => x.rule)).toEqual(["lateCutoff"]);
    expect(r.get(2)?.map((x) => x.rule)).toEqual(["openBlackout"]);
    const s = ruleSummary([late, early], r);
    expect(s.compliance).toBe(0);
    expect(s.rows.find((x) => x.id === "openBlackout")?.netKrw).toBeCloseTo(-3000);
  });
});

describe("⑤ 인출", () => {
  it("잔고가 240만원을 넘으면 200만원 초과분 인출 권장", () => {
    const win = trade(1, "2026-09-30", "22:40", "22:45", 2, 6.5); // +450,000원
    const s = withdrawalStatus([win], [], c);
    expect(s.balance).toBeCloseTo(2_450_000);
    expect(s.recommend).toBeCloseTo(450_000);
    const after = withdrawalStatus([win], [{ date: "2026-10-01", type: "withdraw", amountKrw: 450_000 }], c);
    expect(after.recommend).toBe(0);
  });
});
