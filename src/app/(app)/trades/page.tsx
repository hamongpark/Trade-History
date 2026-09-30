import Link from "next/link";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { addDays, etDate, fmt, formatHold } from "@/lib/domain/time";
import type { PositionView } from "@/lib/domain/types";
import { listPositions } from "@/lib/repo/positions";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function TradesPage({ searchParams }: PageProps<"/trades">) {
  const sp = await searchParams;
  const date = typeof sp.date === "string" ? sp.date : undefined;
  const ticker = typeof sp.ticker === "string" && sp.ticker ? sp.ticker : undefined;
  const incomplete = sp.incomplete === "1";
  const days = Number(sp.days ?? 30);
  const s = await getSettings();
  const today = etDate(new Date());

  let list = await listPositions(date ? { from: date, to: date, ticker } : { from: incomplete ? undefined : addDays(today, -days), ticker });
  if (incomplete) list = list.filter((p) => !p.entryReason || !p.exitReason);

  const byDay = new Map<string, PositionView[]>();
  for (const p of list) byDay.set(p.tradeDate, [...(byDay.get(p.tradeDate) ?? []), p]);

  return (
    <>
      <PageHeader title={incomplete ? "사유 미작성 매매" : date ? `${date} 매매` : "매매 목록"} back={date || incomplete ? "/trades" : undefined} />
      <div className="flex flex-col gap-3 px-4">
        {!date && !incomplete && (
          <form className="flex gap-2">
            <input name="ticker" defaultValue={ticker} placeholder="티커 검색" className="input uppercase" autoCapitalize="characters" />
            <select name="days" defaultValue={String(days)} className="input !w-28">
              <option value="7">7일</option>
              <option value="30">30일</option>
              <option value="90">90일</option>
              <option value="3650">전체</option>
            </select>
            <button className="btn btn-ghost shrink-0">검색</button>
          </form>
        )}
        {list.length === 0 && <p className="py-12 text-center text-sm text-ink-3">기록이 없습니다</p>}
        {[...byDay.entries()].map(([day, ps]) => {
          const total = ps.reduce((a, p) => a + (p.metrics.status === "closed" ? p.krw.net : 0), 0);
          return (
            <section key={day}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <span className="text-sm font-semibold">{day} <span className="text-xs font-normal text-ink-3">{ps.length}건</span></span>
                <Money value={total} className="text-sm font-semibold" />
              </div>
              <ul className="card divide-y divide-border">
                {ps.map((p) => (
                  <li key={p.id}>
                    <Link href={`/trades/${p.id}${incomplete ? "/edit" : ""}`} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {p.ticker}
                          {(!p.entryReason || !p.exitReason) && <span className="ml-2 rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-normal text-warn">사유 미작성</span>}
                        </p>
                        <p className="tnum truncate text-xs text-ink-3">
                          {fmt(p.metrics.openedAt, s.displayTimezone)} · {formatHold(p.metrics.holdSeconds)} · {[...p.setupTags, ...p.emotionTags].join(" · ") || "태그 없음"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {p.metrics.status === "closed" ? <Money value={p.krw.net} className="font-semibold" /> : <span className="text-sm text-warn">보유 중</span>}
                        {p.metrics.rMultiple != null && <p className="tnum text-xs text-ink-3">{p.metrics.rMultiple.toFixed(2)}R</p>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
