"use client";
import { BaselineSeries, ColorType, createChart } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { usd } from "@/lib/format";
import { CHART_COLORS as C } from "./theme";

/** 누적 손익 곡선. 0 위는 빨강, 아래는 파랑 (국내식) */
export function EquityChart({ points, height = 160 }: { points: { date: string; cum: number }[]; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ date: string; cum: number } | null>(null);

  useEffect(() => {
    if (!el.current || points.length === 0) return;
    const byDate = new Map(points.map((p) => [p.date, p]));
    const chart = createChart(el.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: C.muted, fontSize: 10, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: C.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      handleScroll: false,
      handleScale: false,
    });
    const s = chart.addSeries(BaselineSeries, {
      baseValue: { type: "price", price: 0 },
      topLineColor: C.profit,
      topFillColor1: `${C.profit}40`,
      topFillColor2: `${C.profit}05`,
      bottomLineColor: C.loss,
      bottomFillColor1: `${C.loss}05`,
      bottomFillColor2: `${C.loss}40`,
      lineWidth: 2,
      priceFormat: { type: "price", precision: 0, minMove: 1 },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    s.setData(points.map((p) => ({ time: p.date, value: p.cum })));
    chart.subscribeCrosshairMove((e) => setHover(typeof e.time === "string" ? (byDate.get(e.time) ?? null) : null));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [points]);

  if (points.length === 0) return <p className="py-6 text-center text-sm text-ink-3">데이터가 없습니다</p>;
  const shown = hover ?? points[points.length - 1];
  return (
    <div>
      <p className="tnum mb-1 text-xs text-ink-2">
        {shown.date} 누적 {usd(shown.cum)}
      </p>
      <div ref={el} style={{ height }} className="w-full" />
    </div>
  );
}
