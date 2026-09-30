export function usd(x: number, opts: { sign?: boolean; digits?: number } = {}): string {
  const { sign = true, digits = 2 } = opts;
  const s = Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (Math.abs(x) < 0.005) return `$${s}`;
  return `${x < 0 ? "−" : sign ? "+" : ""}$${s}`;
}

export function pct(x: number | null | undefined, digits = 1, sign = true): string {
  if (x == null || !Number.isFinite(x)) return "-";
  const v = (x * 100).toFixed(digits);
  return `${x > 0 && sign ? "+" : ""}${v.replace("-", "−")}%`;
}

export function num(x: number | null | undefined, digits = 2): string {
  if (x == null || !Number.isFinite(x)) return "-";
  return x.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function pnlClass(x: number): string {
  if (x > 0.004) return "text-profit";
  if (x < -0.004) return "text-loss";
  return "text-ink-2";
}

export function price(x: number | null | undefined): string {
  if (x == null) return "-";
  return x >= 1 ? x.toFixed(2) : x.toFixed(4);
}

/** 원화 금액 (원 단위 반올림). 예: +82,300원 */
export function won(x: number, opts: { sign?: boolean } = {}): string {
  const { sign = true } = opts;
  const r = Math.round(x);
  const s = Math.abs(r).toLocaleString("ko-KR");
  if (r === 0) return "0원";
  return `${r < 0 ? "−" : sign ? "+" : ""}${s}원`;
}

/** 좁은 공간용 원화 축약. 예: +8.2만, −125만, +1.3억 */
export function wonCompact(x: number): string {
  const a = Math.abs(x);
  const sign = x > 0 ? "+" : x < 0 ? "−" : "";
  if (a >= 1e8) return `${sign}${(a / 1e8).toFixed(1)}억`;
  if (a >= 1e6) return `${sign}${Math.round(a / 1e4)}만`;
  if (a >= 1e4) return `${sign}${(a / 1e4).toFixed(1).replace(/\.0$/, "")}만`;
  return `${sign}${Math.round(a).toLocaleString("ko-KR")}`;
}

/** USD 주가 (종목 가격은 달러 그대로 표시) */
export function dollar(x: number | null | undefined): string {
  return x == null ? "-" : `$${price(x)}`;
}
