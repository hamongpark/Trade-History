import type { Bucket } from "@/lib/domain/stats";
import { pct, usd } from "@/lib/format";

/** 항목별 합계 손익을 0 기준 좌우 막대로 표시. 행마다 수치를 함께 적어 표 역할도 한다 */
export function BreakdownBars({ buckets, minCount = 1 }: { buckets: Bucket[]; minCount?: number }) {
  const rows = buckets.filter((b) => b.count >= minCount);
  if (rows.length === 0) return <p className="py-3 text-sm text-ink-3">데이터가 부족합니다</p>;
  const max = Math.max(1, ...rows.map((b) => Math.abs(b.netPnl)));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((b) => {
        const w = (Math.abs(b.netPnl) / max) * 50;
        const pos = b.netPnl >= 0;
        return (
          <li key={b.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span className="truncate text-ink">{b.label}</span>
              <span className="tnum shrink-0 text-ink-2">
                {b.count}건 · 승률 {pct(b.winRate, 0, false)} · <span className={pos ? "text-profit" : "text-loss"}>{usd(b.netPnl)}</span>
              </span>
            </div>
            <div className="relative h-2 rounded bg-surface-2">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div
                className="absolute inset-y-0 rounded"
                style={{ left: pos ? "50%" : `${50 - w}%`, width: `${Math.max(w, 0.5)}%`, background: pos ? "var(--profit)" : "var(--loss)" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
