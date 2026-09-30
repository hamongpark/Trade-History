"use client";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHART_COLORS as C } from "./theme";

export interface ChartBar {
  t: number; // UTC epoch seconds (분봉 시작)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}
export interface ChartFill {
  t: number; // UTC epoch seconds
  side: "buy" | "sell";
  price: number;
  qty: number;
}
export interface TzOption {
  label: string;
  /** 해당 시간대의 UTC 오프셋 (초) */
  offset: number;
}

interface Props {
  bars: ChartBar[];
  fills: ChartFill[];
  plannedStop: number | null;
  plannedTarget: number | null;
  avgEntry: number;
  avgExit: number | null;
  /** 원/달러 환율. 가격은 USD 로 받아 원화로 환산해 그린다 */
  fxRate: number;
  timezones: TzOption[];
}

const krw = (x: number) => Math.round(x).toLocaleString("ko-KR");
/** 반투명 캔들 위에 체결 마커가 또렷하게 보이도록 캔들 색을 낮춘다 */
const DIM = "8c";

const fmtVol = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(v));

export function CandleChart({ bars: usdBars, fills, plannedStop, plannedTarget, avgEntry, avgExit, fxRate, timezones }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const [tzIdx, setTzIdx] = useState(0);
  const [hover, setHover] = useState<ChartBar | null>(null);
  const offset = timezones[tzIdx]?.offset ?? 0;
  const bars = useMemo(
    () => usdBars.map((b) => ({ ...b, o: b.o * fxRate, h: b.h * fxRate, l: b.l * fxRate, c: b.c * fxRate })),
    [usdBars, fxRate],
  );
  const barByTime = useMemo(() => new Map(bars.map((b) => [b.t + offset, b])), [bars, offset]);

  useEffect(() => {
    if (!el.current || bars.length === 0) return;
    const chart = createChart(el.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: C.text, fontSize: 11, attributionLogo: false, panes: { separatorColor: C.border } },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      rightPriceScale: { borderColor: C.border },
      localization: { priceFormatter: krw },
      timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      handleScale: { axisPressedMouseMove: false },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: C.profit + DIM,
      downColor: C.loss + DIM,
      borderUpColor: C.profit + DIM,
      borderDownColor: C.loss + DIM,
      wickUpColor: C.profit + DIM,
      wickDownColor: C.loss + DIM,
      priceLineVisible: false,
      priceFormat: { type: "price", precision: 0, minMove: 1 },
    });
    candles.setData(bars.map((b) => ({ time: (b.t + offset) as UTCTimestamp, open: b.o, high: b.h, low: b.l, close: b.c })));

    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false }, 1);
    volume.setData(
      bars.map((b) => ({ time: (b.t + offset) as UTCTimestamp, value: b.v, color: b.c >= b.o ? `${C.profit}66` : `${C.loss}66` })),
    );
    chart.panes()[1]?.setHeight(70);

    // 실제 체결 가격은 가로선으로, 체결 시점은 캔들 위·아래 화살표로 표시해 캔들과 겹치지 않게 한다
    candles.createPriceLine({ price: avgEntry * fxRate, color: C.profit, lineStyle: LineStyle.Dotted, lineWidth: 1, title: "매수가", axisLabelVisible: true });
    if (avgExit) candles.createPriceLine({ price: avgExit * fxRate, color: C.loss, lineStyle: LineStyle.Dotted, lineWidth: 1, title: "매도가", axisLabelVisible: true });
    if (plannedStop) candles.createPriceLine({ price: plannedStop * fxRate, color: C.muted, lineStyle: LineStyle.Dashed, lineWidth: 1, title: "손절", axisLabelVisible: true });
    if (plannedTarget) candles.createPriceLine({ price: plannedTarget * fxRate, color: C.target, lineStyle: LineStyle.Dashed, lineWidth: 1, title: "목표", axisLabelVisible: true });

    const markers: SeriesMarker<Time>[] = fills
      .map((f) => ({
        time: (Math.floor(f.t / 60) * 60 + offset) as UTCTimestamp,
        position: f.side === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
        shape: f.side === "buy" ? ("arrowUp" as const) : ("arrowDown" as const),
        color: f.side === "buy" ? C.profit : C.loss,
        text: `${f.side === "buy" ? "매수" : "매도"} ${krw(f.price * fxRate)}`,
        size: 2,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));
    createSeriesMarkers(candles, markers, { zOrder: "top" });

    chart.subscribeCrosshairMove((p) => setHover(p.time ? (barByTime.get(p.time as number) ?? null) : null));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, fills, plannedStop, plannedTarget, avgEntry, avgExit, fxRate, offset, barByTime]);

  if (bars.length === 0) return null;
  const shown = hover ?? bars[bars.length - 1];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-ink-2">
        <span className="tnum truncate">
          시 {krw(shown.o)} · 고 {krw(shown.h)} · 저 {krw(shown.l)} · 종{" "}
          <span className={shown.c >= shown.o ? "text-profit" : "text-loss"}>{krw(shown.c)}</span> · 거래량 {fmtVol(shown.v)}
        </span>
        {timezones.length > 1 && (
          <div className="flex shrink-0 gap-1">
            {timezones.map((tz, i) => (
              <button key={tz.label} className="chip !px-2 !py-0.5 text-[11px]" data-on={i === tzIdx} onClick={() => setTzIdx(i)}>
                {tz.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div ref={el} className="h-[340px] w-full" />
    </div>
  );
}
