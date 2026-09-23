import { getTimezoneOffset } from "date-fns-tz";
import { notFound } from "next/navigation";
import { CandleChart, type TzOption } from "@/components/charts/CandleChart";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { Stat } from "@/components/Stat";
import { TradeActions } from "@/components/TradeActions";
import { candleWindow, loadCandles } from "@/lib/candles";
import { ET, KST, fmt, formatHold } from "@/lib/domain/time";
import { pct, price, usd } from "@/lib/format";
import { getPosition } from "@/lib/repo/positions";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function TradeDetail({ params }: PageProps<"/trades/[id]">) {
  const id = Number((await params).id);
  const [p, s] = await Promise.all([getPosition(id), getSettings()]);
  if (!p) notFound();
  const m = p.metrics;
  const tz = s.displayTimezone;
  const { from, to } = candleWindow(p);
  const bars = p.candlesStatus === "ok" ? await loadCandles(p.ticker, from, to) : [];
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
            {m.status === "closed" ? <Money value={m.netPnl} className="text-3xl font-bold" /> : <span className="text-2xl font-bold">미청산 {m.openQty}주</span>}
            {m.status === "closed" && <span className="tnum text-sm text-ink-2">{pct(m.returnPct, 2)}</span>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="보유 시간" value={formatHold(m.holdSeconds)} />
            <Stat label="R 배수" value={m.rMultiple != null ? `${m.rMultiple.toFixed(2)}R` : "-"} />
            <Stat label="수수료" value={usd(m.fees, { sign: false })} />
            <Stat label="평균 매수가" value={price(m.avgEntry)} sub={`최대 ${m.maxQty}주`} />
            <Stat label="평균 매도가" value={price(m.avgExit)} />
            <Stat label="체결" value={`${m.fillCount}회`} />
          </div>
        </section>

        <section className="card p-3">
          <p className="mb-2 px-1 text-sm font-semibold">체결 전후 30분 · 1분봉</p>
          {bars.length > 0 ? (
            <CandleChart
              bars={bars.map((b) => ({ t: b.ts.getTime() / 1000, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume }))}
              fills={p.executions.map((x) => ({ t: x.executedAt.getTime() / 1000, side: x.side, price: x.price, qty: x.qty }))}
              plannedStop={p.plannedStop}
              plannedTarget={p.plannedTarget}
              avgEntry={m.avgEntry}
              timezones={timezones}
            />
          ) : (
            <p className="px-1 py-8 text-center text-sm text-ink-3">
              {p.candlesStatus === "error" ? `분봉을 가져오지 못했습니다: ${p.candlesError}` : "분봉 데이터가 없습니다. 아래에서 불러오기를 눌러주세요."}
            </p>
          )}
        </section>

        {e && (
          <section className="card p-4">
            <p className="mb-2 text-sm font-semibold">분봉으로 본 이 매매</p>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="최대 역행 (MAE)" value={<span className="text-loss">{pct(e.maePct, 2)}</span>} sub={usd(e.maeUsd)} />
              <Stat label="최대 순행 (MFE)" value={<span className="text-profit">{pct(e.mfePct, 2)}</span>} sub={usd(e.mfeUsd)} />
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
                  <td className="text-right">{price(x.price)}</td>
                  <td className="text-right">{x.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(p.plannedStop || p.plannedTarget) && (
            <p className="tnum mt-2 text-xs text-ink-3">
              계획 손절 {price(p.plannedStop)} · 목표 {price(p.plannedTarget)}
            </p>
          )}
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
