import Link from "next/link";
import { desc } from "drizzle-orm";
import { EquityChart } from "@/components/charts/EquityChart";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { PnlCalendar } from "@/components/PnlCalendar";
import { RuleStatusCard } from "@/components/RuleStatusCard";
import { WithdrawButton } from "@/components/WithdrawButton";
import { Stat } from "@/components/Stat";
import { getDb, schema } from "@/lib/db";
import { computeStats } from "@/lib/domain/stats";
import { dayStatus, evaluateRules, withdrawalStatus } from "@/lib/domain/rules";
import { KST, addDays, etDate, fmt, formatHold } from "@/lib/domain/time";
import { pct, won } from "@/lib/format";
import { listCashFlows } from "@/lib/repo/cashflows";
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

  const [settings, all, incomplete, db, cashFlows] = await Promise.all([
    getSettings(),
    listPositions({ from, to }),
    countIncomplete(),
    getDb(),
    listCashFlows(),
  ]);
  const start = settings.rules.capitalStartDate;
  // 잔고 계산 범위가 이미 불러온 기간 안이면 다시 조회하지 않는다
  const capitalPositions = start && start >= from ? all.filter((p) => p.tradeDate >= start) : await listPositions({ from: start ?? undefined });
  const [latestReport] = await db
    .select({ id: schema.aiReports.id, focus: schema.aiReports.focus, periodStart: schema.aiReports.periodStart })
    .from(schema.aiReports)
    .orderBy(desc(schema.aiReports.periodStart))
    .limit(1);

  const stats = computeStats(all);
  const todayRow = stats.daily.find((d) => d.date === today);
  const prevRow = [...stats.daily].reverse().find((d) => d.date < today);
  const monthStats = computeStats(all.filter((p) => p.tradeDate.startsWith(month)));
  const equity = stats.equity.slice(-30);
  const base = equity.length ? equity[0].cum - (stats.daily.find((d) => d.date === equity[0].date)?.netPnl ?? 0) : 0;
  const equity30 = equity.map((e) => ({ date: e.date, cum: e.cum - base }));

  const todayPnl = todayRow?.netPnl ?? 0;
  const todays = all.filter((p) => p.tradeDate === today);
  const status = dayStatus(todays, settings.rules);
  const results = evaluateRules(todays, settings.rules);
  const violationsToday = todays.filter((p) => results.get(p.id)?.some((r) => r.kind === "violation")).length;
  const withdrawal = withdrawalStatus(capitalPositions, cashFlows, settings.rules);

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
        {/* 그라운드 룰: 지금 매매해도 되는지 */}
        <RuleStatusCard status={status} violationsToday={violationsToday} bigLossPct={settings.rules.bigLossPct} />

        {/* 오늘 / 직전 거래일 */}
        <section className="card grid grid-cols-2 divide-x divide-border p-4">
          <div className="pr-3">
            <p className="text-xs text-ink-3">오늘 · {today.slice(5).replace("-", "/")}</p>
            <Money value={todayPnl} className="mt-1 block text-[22px] leading-tight font-bold" />
            <p className="tnum text-xs text-ink-3">
              {todayRow ? `${todayRow.count}건 · ${todayRow.wins}승 ${todayRow.count - todayRow.wins}패` : "매매 없음"}
            </p>
          </div>
          <div className="pl-3">
            <p className="text-xs text-ink-3">이전 거래일{prevRow ? ` · ${prevRow.date.slice(5).replace("-", "/")}` : ""}</p>
            <Money value={prevRow?.netPnl ?? 0} className="mt-1 block text-[22px] leading-tight font-bold" />
            <p className="tnum text-xs text-ink-3">{prevRow ? `${prevRow.count}건 · ${prevRow.wins}승 ${prevRow.count - prevRow.wins}패` : "-"}</p>
          </div>
        </section>

        {withdrawal.recommend > 0 && (
          <section className="card flex flex-col gap-2 border-profit/50 p-4">
            <p className="font-semibold">💰 인출할 때입니다 · 룰 ⑤</p>
            <p className="text-xs text-ink-2">
              추정 잔고 {won(withdrawal.balance, { sign: false })} → 거래 자금 {won(settings.rules.capitalKrw, { sign: false })} 초과분을 인출하세요
            </p>
            <WithdrawButton amountKrw={withdrawal.recommend} date={fmt(new Date(), KST, "yyyy-MM-dd")} />
          </section>
        )}

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
