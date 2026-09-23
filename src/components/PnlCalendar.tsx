import Link from "next/link";
import type { DailyPnl } from "@/lib/domain/stats";
import { addDays } from "@/lib/domain/time";

const compact = (x: number) => {
  const a = Math.abs(x);
  const s = a >= 1000 ? `${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : a.toFixed(0);
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${s}`;
};

/** 평일(월~금) 기준 월간 손익 달력. 셀 색 농도 = 해당 월 최대 손익 대비 크기 */
export function PnlCalendar({ month, daily, today }: { month: string; daily: DailyPnl[]; today: string }) {
  const map = new Map(daily.map((d) => [d.date, d]));
  const first = `${month}-01`;
  const max = Math.max(1, ...daily.filter((d) => d.date.startsWith(month)).map((d) => Math.abs(d.netPnl)));
  const firstDow = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7; // 월=0
  let cursor = addDays(first, -Math.min(firstDow, 5));
  const weeks: string[][] = [];
  while (cursor.slice(0, 7) <= month) {
    const week = [0, 1, 2, 3, 4].map((i) => addDays(cursor, i));
    if (week.some((d) => d.startsWith(month))) weeks.push(week);
    cursor = addDays(cursor, 7);
  }

  return (
    <div>
      <div className="mb-1 grid grid-cols-5 text-center text-[11px] text-ink-3">
        {["월", "화", "수", "목", "금"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-[2px]">
        {weeks.flat().map((date) => {
          const inMonth = date.startsWith(month);
          const d = map.get(date);
          const intensity = d ? 14 + Math.round((Math.abs(d.netPnl) / max) * 46) : 0;
          const color = d && d.netPnl > 0 ? "var(--profit)" : "var(--loss)";
          const style = d && Math.abs(d.netPnl) >= 0.005 ? { background: `color-mix(in oklab, ${color} ${intensity}%, var(--surface-2))` } : undefined;
          const body = (
            <div
              className={`flex h-14 flex-col justify-between rounded-md p-1 ${inMonth ? "bg-surface-2" : "opacity-30"} ${date === today ? "ring-1 ring-ink-2" : ""}`}
              style={style}
              title={d ? `${date} ${d.count}건 ${d.netPnl.toFixed(2)}` : date}
            >
              <span className="text-[10px] text-ink-2">{Number(date.slice(8))}</span>
              {d && (
                <span className="tnum text-right text-[11px] font-semibold text-ink">
                  {compact(d.netPnl)}
                </span>
              )}
            </div>
          );
          return d && inMonth ? (
            <Link key={date} href={`/trades?date=${date}`}>
              {body}
            </Link>
          ) : (
            <div key={date}>{body}</div>
          );
        })}
      </div>
    </div>
  );
}
