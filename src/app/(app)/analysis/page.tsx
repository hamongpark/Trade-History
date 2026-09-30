import Link from "next/link";
import { BreakdownBars } from "@/components/BreakdownBars";
import { EquityChart } from "@/components/charts/EquityChart";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { Stat } from "@/components/Stat";
import { deriveInsights } from "@/lib/domain/insights";
import { BREAKDOWN_LABELS, computeStats, type BreakdownKey } from "@/lib/domain/stats";
import { addDays, etDate, formatHold, mondayOf } from "@/lib/domain/time";
import { pct, won } from "@/lib/format";
import { listPositions } from "@/lib/repo/positions";

export const dynamic = "force-dynamic";

const PERIODS = [
  { key: "week", label: "이번 주" },
  { key: "month", label: "이번 달" },
  { key: "3m", label: "3개월" },
  { key: "all", label: "전체" },
] as const;

const ORDER: BreakdownKey[] = ["timeOfDay", "setup", "holdTime", "tradeNumber", "afterPrev", "emotion", "followedPlan", "confidence", "weekday", "ticker"];

export default async function AnalysisPage({ searchParams }: PageProps<"/analysis">) {
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.key === sp.p)?.key ?? "month";
  const today = etDate(new Date());
  const from = { week: mondayOf(today), month: `${today.slice(0, 7)}-01`, "3m": addDays(today, -91), all: undefined }[period];
  const stats = computeStats(await listPositions({ from }));
  const s = stats.summary;
  const insights = deriveInsights(stats);
  const ex = stats.excursion;

  return (
    <>
      <PageHeader title="매매 스타일 분석" />
      <div className="flex flex-col gap-3 px-4">
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Link key={p.key} href={`/analysis?p=${p.key}`} className="chip flex-1 text-center" data-on={p.key === period}>
              {p.label}
            </Link>
          ))}
        </div>

        {s.count === 0 ? (
          <p className="py-12 text-center text-sm text-ink-3">청산된 매매가 없습니다</p>
        ) : (
          <>
            <section className="card p-4">
              <p className="text-xs text-ink-3">순손익 · {s.count}건</p>
              <Money value={s.netPnl} className="text-3xl font-bold" />
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat label="승률" value={pct(s.winRate, 1, false)} sub={`${s.wins}승 ${s.losses}패`} />
                <Stat label="손익비" value={s.payoff?.toFixed(2) ?? "-"} sub="평균이익/평균손실" />
                <Stat label="Profit Factor" value={s.profitFactor?.toFixed(2) ?? "-"} />
                <Stat label="기대값 / 매매" value={won(s.expectancy)} />
                <Stat label="평균 R" value={s.avgR != null ? `${s.avgR.toFixed(2)}R` : "-"} />
                <Stat label="최대 낙폭" value={won(s.maxDrawdown)} />
                <Stat label="평균 이익" value={won(s.avgWin)} />
                <Stat label="평균 손실" value={won(s.avgLoss)} />
                <Stat label="수수료 합계" value={won(s.fees, { sign: false })} />
                <Stat label="보유 (이익)" value={formatHold(s.avgHoldWin)} />
                <Stat label="보유 (손실)" value={formatHold(s.avgHoldLoss)} />
                <Stat label="최대 연패" value={`${s.maxLossStreak}연패`} sub={`최대 연승 ${s.maxWinStreak}`} />
              </div>
            </section>

            <section className="card p-4">
              <p className="mb-2 text-sm font-semibold">누적 손익</p>
              <EquityChart points={stats.equity} />
            </section>

            <section className="card p-4">
              <p className="mb-3 text-sm font-semibold">장단점 진단</p>
              {insights.length === 0 ? (
                <p className="text-sm text-ink-3">진단하려면 매매가 5건 이상 필요합니다</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {insights.map((i) => (
                    <li key={i.title} className="flex gap-2.5">
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${i.kind === "strength" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"}`}>
                        {i.kind === "strength" ? "강점" : "개선"}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{i.title}</p>
                        <p className="text-xs text-ink-2">{i.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {ex.count > 0 && (
              <section className="card p-4">
                <p className="mb-2 text-sm font-semibold">분봉 기반 진단 <span className="text-xs font-normal text-ink-3">({ex.count}건)</span></p>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="이익 매매 평균 역행" value={pct(ex.avgMaeWin, 2)} sub="진입 정확도" />
                  <Stat label="손실 매매 평균 역행" value={pct(ex.avgMaeLoss, 2)} sub="손절 폭" />
                  <Stat label="매도 후 30분 추가 상승" value={pct(ex.avgPostExitHighWin, 2)} sub="이익 매매 평균" />
                  <Stat label="수익 포착률" value={ex.avgCapture != null ? pct(ex.avgCapture, 0, false) : "-"} />
                  <Stat label="이익→손실 전환" value={`${ex.lossesThatWereGreen}건`} sub="+0.5% 이상이던 손실" />
                  <Stat label="추격매수" value={`${ex.chase.count}건`} sub={ex.chase.count ? `승률 ${pct(ex.chase.winRate, 0, false)} · 평균 ${won(ex.chase.avgPnl)}` : "진입 전 10분 +2%↑"} />
                </div>
              </section>
            )}

            {ORDER.map((k) => (
              <section key={k} className="card p-4">
                <p className="mb-3 text-sm font-semibold">{BREAKDOWN_LABELS[k]}</p>
                <BreakdownBars buckets={stats.breakdowns[k]} />
              </section>
            ))}
          </>
        )}
      </div>
    </>
  );
}
