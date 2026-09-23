import { pnlClass, usd } from "@/lib/format";

export function Money({ value, className = "", digits = 2 }: { value: number; className?: string; digits?: number }) {
  return <span className={`tnum ${pnlClass(value)} ${className}`}>{usd(value, { digits })}</span>;
}
