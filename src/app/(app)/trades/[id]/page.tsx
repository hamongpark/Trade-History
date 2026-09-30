import { getTimezoneOffset } from "date-fns-tz";
import { notFound } from "next/navigation";
import { CandleChart, type TzOption } from "@/components/charts/CandleChart";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { Stat } from "@/components/Stat";
import { TradeActions } from "@/components/TradeActions";
import { candleWindow, loadCandles, needsRefetch, refreshCandlesWithTimeout } from "@/lib/candles";
import { ET, KST, fmt, formatHold } from "@/lib/domain/time";
import { dollar, pct, won } from "@/lib/format";
import { getPosition } from "@/lib/repo/positions";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function TradeDetail({ params }: PageProps<"/trades/[id]">) {
  const id = Number((await params).id);
  const [first, s] = await Promise.all([getPosition(id), getSettings()]);
  if (!first) notFound();
  // 매매 직후 저장해 매도 이후 분봉이 비어 있었다면, 시세 지연이 풀린 지금 다시 받아온다
  let p = first;
  if (needsRefetch(first)) {
    await refreshCandlesWithTimeout(id);
    p = (await getPosition(id)) ?? first;
  }
  const m = p.metrics;
  const tz = s.displayTimezone;
  const { from, to } = candleWindow(p);
  const bars = p.candlesStatus === "ok" || p.candlesStatus === "partial" ? await loadCandles(p.ticker, from, to) : [];
  const zones = [tz, ...[KST, ET].filter((z) => z !== tz)];
  const timezones: TzOption[] = zones.map((z) => ({ label: z === KST ? "KST" : z === ET ? "ET" : z, offset: getTimezoneOffset(z, m.openedAt) / 1000 }));
  const e = p.excursion;

  return (
    <>
      <PageHeader title={`${p.ticker}`} back="/trades" />
      <div className="flex flex-col gap-3 px-4">
        <section className="card p-4">
          <p className="text-xs text-ink-3">
            {fmt(m.openedAt, tz, "yyyy.MM.dd HH:mm")} → {m.closedAt ? fmt(m.closedAt, tz, "HH:mm") : "보유 중"} · {tz === KST ? "KST" : "ET"}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            {m.status === "closed" ? <Money value={p.krw.net} className="text-3xl font-bold" /> : <span className="text-2xl font-bold">미청산 {m.openQty}주</span>}
            {m.status === "closed" && <span className="tnum text-sm text-ink-2">{pct(m.returnPct, 2)}</span>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="보유 시간" value={formatHold(m.holdSeconds)} />
            <Stat label="R 배수" value={m.rMultiple != null ? `${m.rMultiple.toFixed(2)}R` : "-"} />
            <Stat label="수수료" value={won(p.krw.fees, { sign: false })} sub={`$${m.fees.toFixed(2)}`} />
            <Stat label="평균 매수가" value={won(m.avgEntry * p.fxRate, { sign: false })} sub={`${dollar(m.avgEntry)} · 최대 ${m.maxQty}주`} />
            <Stat label="평균 매도가" value={m.avgExit != null ? won(m.avgExit * p.fxRate, { sign: false }) : "-"} sub={`${dollar(m.avgExit)} · 손익 ${m.netPnl < 0 ? "−" : "+"}$${Math.abs(m.netPnl).toFixed(2)}`} />
            <Stat label="체결" value={`${m.fillCount}회`} />
          </div>
        </section>

        <section className="card p-3">
          <p className="mb-2 px-1 text-sm font-semibold">체결 전후 30분 · 1분봉 <span className="text-xs font-normal text-ink-3">(원화 환산)</span></p>
          {bars.length > 0 ? (
            <CandleChart
              bars={bars.map((b) => ({ t: b.ts.getTime() / 1000, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume }))}
              fills={p.executions.map((x) => ({ t: x.executedAt.getTime() / 1000, side: x.side, price: x.price, qty: x.qty }))}
              plannedStop={p.stopPrice}
              plannedTarget={p.targetPrice}
              avgEntry={m.avgEntry}
              avgExit={m.avgExit}
              fxRate={p.fxRate}
              timezones={timezones}
            />
          ) : null}
          {bars.length > 0 && p.candlesStatus === "partial" && (
            <p className="mt-2 px-1 text-xs text-ink-3">매도 이후 분봉은 시세 지연(약 15분)이 지나면 이 화면을 다시 열 때 자동으로 채워집니다.</p>
          )}
          {bars.length === 0 && (
            <p className="px-1 py-8 text-center text-sm text-ink-3">
              {p.candlesStatus === "error" ? `분봉을 가져오지 못했습니다: ${p.candlesError}` : "분봉 데이터가 없습니다. 아래에서 불러오기를 눌러주세요."}
            </p>
          )}
        </section>

        {e && (
          <section className="card p-4">
            <p className="mb-2 text-sm font-semibold">분봉으로 본 이 매매</p>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="최대 역행 (MAE)" value={<span className="text-loss">{pct(e.maePct, 2)}</span>} sub={won(e.maeUsd * p.fxRate)} />
              <Stat label="최대 순행 (MFE)" value={<span className="text-profit">{pct(e.mfePct, 2)}</span>} sub={won(e.mfeUsd * p.fxRate)} />
              <Stat label="매도 후 30분 최고" value={pct(e.postExitHighPct, 2)} sub="평균 매도가 대비" />
              <Stat label="진입 전 10분 변화" value={pct(e.preEntryChangePct, 2)} sub={(e.preEntryChangePct ?? 0) >= 0.02 ? "추격매수 주의" : undefined} />
              <Stat label="수익 포착률" value={e.captureRatio != null ? pct(e.captureRatio, 0, false) : "-"} sub="실현 / 최대 가능" />
            </div>
          </section>
        )}

        <section className="card p-4">
          <p className="mb-2 text-sm font-semibold">체결 내역</p>
          <table className="tnum w-full text-sm">
            <thead className="text-left text-[11px] text-ink-3">
              <tr>
                <th className="pb-1 font-normal">구분</th>
                <th className="pb-1 font-normal">시각</th>
                <th className="pb-1 text-right font-normal">가격</th>
                <th className="pb-1 text-right font-normal">수량</th>
              </tr>
            </thead>
            <tbody>
              {p.executions.map((x, i) => (
                <tr key={i} className="border-t border-border">
                  <td className={`py-1.5 ${x.side === "buy" ? "text-profit" : "text-loss"}`}>{x.side === "buy" ? "매수" : "매도"}</td>
                  <td>{fmt(x.executedAt, tz, "HH:mm")}</td>
                  <td className="text-right">
                    {won(x.price * p.fxRate, { sign: false })}
                    <span className="block text-[11px] text-ink-3">{dollar(x.price)}</span>
                  </td>
                  <td className="text-right">{x.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(p.stopPct != null || p.targetPct != null) && (
            <p className="tnum mt-2 text-xs text-ink-3">
              계획 손절 {p.stopPct != null && p.stopPrice != null ? `−${p.stopPct}% (${won(p.stopPrice * p.fxRate, { sign: false })})` : "-"} · 목표{" "}
              {p.targetPct != null && p.targetPrice != null ? `+${p.targetPct}% (${won(p.targetPrice * p.fxRate, { sign: false })})` : "-"}
            </p>
          )}
          <p className="tnum mt-1 text-xs text-ink-3">
            적용 환율 {p.fxRate.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원{p.fxProvisional ? " (임시값 · 수정에서 입력 가능)" : ""}
          </p>
        </section>

        <section className="card flex flex-col gap-3 p-4 text-sm">
          {[...p.setupTags, ...p.emotionTags].length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {p.setupTags.map((t) => (
                <span key={t} className="chip !py-1 text-xs">{t}</span>
              ))}
              {p.emotionTags.map((t) => (
                <span key={t} className="chip !py-1 text-xs" data-on>{t}</span>
              ))}
            </div>
          )}
          <Reason label="매수 사유" text={p.entryReason} />
          <Reason label="매도 사유" text={p.exitReason} />
          {p.note && <Reason label="메모" text={p.note} />}
          <p className="text-xs text-ink-3">
            확신도 {p.confidence ?? "-"} · 계획 준수 {p.followedPlan == null ? "-" : p.followedPlan ? "예" : "아니오"}
          </p>
        </section>

        <TradeActions id={p.id} candlesStatus={p.candlesStatus} />
      </div>
    </>
  );
}

function Reason({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className={`mt-0.5 whitespace-pre-wrap ${text ? "" : "text-warn"}`}>{text || "미작성"}</p>
    </div>
  );
}
