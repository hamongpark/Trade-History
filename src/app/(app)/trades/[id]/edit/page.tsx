import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { TradeForm } from "@/components/TradeForm";
import type { FormValues } from "@/lib/trade-form";
import { fmt } from "@/lib/domain/time";
import { getPosition } from "@/lib/repo/positions";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function EditTradePage({ params }: PageProps<"/trades/[id]/edit">) {
  const id = Number((await params).id);
  const [p, s] = await Promise.all([getPosition(id), getSettings()]);
  if (!p) notFound();
  const tz = s.inputTimezone;
  const initial: FormValues = {
    ticker: p.ticker,
    fills: p.executions.map((e, i) => ({
      key: `e${e.id ?? i}`,
      side: e.side,
      date: fmt(e.executedAt, tz, "yyyy-MM-dd"),
      time: fmt(e.executedAt, tz, "HH:mm"),
      price: String(e.price),
      qty: String(e.qty),
      fee: String(e.fee),
    })),
    stopPct: p.stopPct?.toString() ?? "",
    targetPct: p.targetPct?.toString() ?? "",
    fxRate: p.fxProvisional ? "" : String(p.fxRate),
    setupTags: p.setupTags,
    emotionTags: p.emotionTags,
    confidence: p.confidence,
    followedPlan: p.followedPlan,
    wouldReenter: p.wouldReenter,
    entryReason: p.entryReason,
    exitReason: p.exitReason,
    note: p.note,
  };
  return (
    <>
      <PageHeader title={`${p.ticker} 수정`} back={`/trades/${id}`} />
      <TradeForm
        settings={{ inputTimezone: tz, feeRatePct: s.feeRatePct, setupTags: s.setupTags, emotionTags: s.emotionTags, defaultStopPct: s.defaultStopPct, defaultTargetPct: s.defaultTargetPct }}
        initial={initial}
        positionId={id}
        defaultDate={initial.fills[0]?.date ?? fmt(new Date(), tz, "yyyy-MM-dd")}
      />
    </>
  );
}
