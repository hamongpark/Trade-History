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
