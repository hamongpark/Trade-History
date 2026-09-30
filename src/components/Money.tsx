import { pnlClass, won } from "@/lib/format";

/** 원화 손익 표시 (이익 빨강 / 손실 파랑, 항상 부호) */
export function Money({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`tnum ${pnlClass(value)} ${className}`}>{won(value)}</span>;
}
