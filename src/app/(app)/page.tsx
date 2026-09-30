import Link from "next/link";
import { desc } from "drizzle-orm";
import { EquityChart } from "@/components/charts/EquityChart";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { PnlCalendar } from "@/components/PnlCalendar";
import { Stat } from "@/components/Stat";
import { getDb, schema } from "@/lib/db";
import { computeStats } from "@/lib/domain/stats";
import { addDays, etDate, formatHold } from "@/lib/domain/time";
import { pct, won } from "@/lib/format";
import { countIncomplete, listPositions } from "@/lib/repo/positions";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function shiftMonth(m: string, n: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const today = etDate(new Date());
  const month = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : today.slice(0, 7);
  const monthEnd = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const from = [`${month}-01`, addDays(today, -60)].sort()[0];
  const to = [monthEnd, today].sort()[1];

  const [settings, all, incomplete, db] = await Promise.all([getSettings(), listPositions({ from, to }), countIncomplete(), getDb()]);
  const [latestReport] = await db
    .select({ id: schema.aiReports.id, focus: schema.aiReports.focus, periodStart: schema.aiReports.periodStart })
    .from(schema.aiReports)
    .orderBy(desc(schema.aiReports.periodStart))
    .limit(1);

  const stats = computeStats(all);
  const todayRow = stats.daily.find((d) => d.date === today);
  const prevRow = [...stats.daily].reverse().find((d) => d.date < today);
  const todayTrades = all.filter((p) => p.tradeDate === today).length;
  const monthStats = computeStats(all.filter((p) => p.tradeDate.startsWith(month)));
  const equity = stats.equity.slice(-30);
  const base = equity.length ? equity[0].cum - (stats.daily.find((d) => d.date === equity[0].date)?.netPnl ?? 0) : 0;
  const equity30 = equity.map((e) => ({ date: e.date, cum: e.cum - base }));

  const todayPnl = todayRow?.netPnl ?? 0;
  const lossUsed = settings.dailyLossLimitKrw > 0 ? Math.max(0, -todayPnl) / settings.dailyLossLimitKrw : 0;
  const tradeUsed = todayTrades / settings.maxTradesPerDay;

  return (
    <>
      <PageHeader
        title="매매일지"
        right={
          <Link href="/settings" aria-label="설정" className="p-2 text-ink-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
            </svg>
          </Link>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        {/* 오늘 / 직전 거래일 */}
        <section className="card grid grid-cols-2 divide-x divide-border p-4">
          <div className="pr-3">
            <p className="text-xs text-ink-3">오늘 · {today.slice(5).replace("-", "/")} ET</p>
            <Money value={todayPnl} className="mt-1 block text-2xl font-bold" />
            <p className="tnum text-xs text-ink-3">
              {todayRow ? `${todayRow.count}건 · ${todayRow.wins}승 ${todayRow.count - todayRow.wins}패` : "매매 없음"}
            </p>
          </div>
          <div className="pl-3">
            <p className="text-xs text-ink-3">이전 거래일{prevRow ? ` · ${prevRow.date.slice(5).replace("-", "/")}` : ""}</p>
            <Money value={prevRow?.netPnl ?? 0} className="mt-1 block text-2xl font-bold" />
            <p className="tnum text-xs text-ink-3">{prevRow ? `${prevRow.count}건 · ${prevRow.wins}승 ${prevRow.count - prevRow.wins}패` : "-"}</p>
          </div>
        </section>

        {/* 오늘의 규칙 가드 */}
        <section className="card flex flex-col gap-3 p-4">
          <Gauge label="일 손실 한도" used={lossUsed} text={`${won(Math.min(0, todayPnl), { sign: false })} / −${won(settings.dailyLossLimitKrw, { sign: false })}`} />
          <Gauge label="오늘 매매 횟수" used={tradeUsed} text={`${todayTrades} / ${settings.maxTradesPerDay}회`} />
          {(lossUsed >= 1 || tradeUsed >= 1) && (
            <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">⚠ 오늘 한도에 도달했습니다. 오늘은 여기까지.</p>
          )}
        </section>

        {incomplete > 0 && (
          <Link href="/trades?incomplete=1" className="card flex items-center justify-between p-4 text-sm">
            <span>✍️ 매수/매도 사유 미작성 {incomplete}건</span>
            <span className="text-ink-3">작성하기 ›</span>
          </Link>
        )}

        {latestReport?.focus && (
          <Link href={`/reports/${latestReport.id}`} className="card block p-4">
            <p className="text-xs text-ink-3">이번 주 집중할 한 가지 · AI 코치</p>
            <p className="mt-1 text-[15px] leading-snug">{latestReport.focus}</p>
          </Link>
        )}

        {/* 월간 달력 */}
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <Link href={`/?m=${shiftMonth(month, -1)}`} className="px-2 text-ink-2" aria-label="이전 달">
              ‹
            </Link>
            <div className="text-center">
              <p className="text-sm font-semibold">{month.replace("-", "년 ")}월</p>
              <Money value={monthStats.summary.netPnl} className="text-lg font-bold" />
            </div>
            <Link href={`/?m=${shiftMonth(month, 1)}`} className="px-2 text-ink-2" aria-label="다음 달">
              ›
            </Link>
          </div>
          <PnlCalendar month={month} daily={stats.daily} today={today} />
          <div className="mt-3 grid grid-cols-4 gap-2">
            <Stat label="매매" value={`${monthStats.summary.count}건`} />
            <Stat label="승률" value={pct(monthStats.summary.winRate, 0, false)} />
            <Stat label="손익비" value={monthStats.summary.payoff?.toFixed(2) ?? "-"} />
            <Stat label="PF" value={monthStats.summary.profitFactor?.toFixed(2) ?? "-"} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Stat label="평균 보유 (이익)" value={formatHold(monthStats.summary.avgHoldWin)} />
            <Stat label="평균 보유 (손실)" value={formatHold(monthStats.summary.avgHoldLoss)} />
          </div>
        </section>

        <section className="card p-4">
          <p className="mb-2 text-sm font-semibold">최근 30거래일 누적 손익</p>
          <EquityChart points={equity30} />
        </section>
      </div>
    </>
  );
}

function Gauge({ label, used, text }: { label: string; used: number; text: string }) {
  const w = Math.min(1, used) * 100;
  const color = used >= 1 ? "var(--warn)" : used >= 0.7 ? "color-mix(in oklab, var(--warn) 70%, var(--text-muted))" : "var(--text-muted)";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-ink-2">{label}</span>
        <span className="tnum text-ink-2">{text}</span>
      </div>
      <div className="h-2 rounded bg-surface-2">
        <div className="h-2 rounded" style={{ width: `${w}%`, background: color }} />
      </div>
    </div>
  );
}
