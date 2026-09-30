import { describe, expect, it } from "vitest";
import { parseFrankfurter } from "@/lib/domain/fx";
import { won, wonCompact } from "@/lib/format";

describe("원화 표시", () => {
  it("won", () => {
    expect(won(82345.6)).toBe("+82,346원");
    expect(won(-1200)).toBe("−1,200원");
    expect(won(0.3)).toBe("0원");
    expect(won(-5000, { sign: false })).toBe("−5,000원");
    expect(won(5000, { sign: false })).toBe("5,000원");
  });
  it("wonCompact", () => {
    expect(wonCompact(82300)).toBe("+8.2만");
    expect(wonCompact(-1250000)).toBe("−125만");
    expect(wonCompact(5300)).toBe("+5,300");
    expect(wonCompact(130000000)).toBe("+1.3억");
  });
});

describe("환율 응답 파싱", () => {
  it("Frankfurter", () => {
    expect(parseFrankfurter({ amount: 1, base: "USD", date: "2026-09-29", rates: { KRW: 1391.52 } })).toEqual({ rate: 1391.52, rateDate: "2026-09-29" });
    expect(parseFrankfurter({ message: "not found" })).toBeNull();
    expect(parseFrankfurter(null)).toBeNull();
  });
});
