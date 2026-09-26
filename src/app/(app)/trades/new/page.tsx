import { PageHeader } from "@/components/PageHeader";
import { aiEnabled } from "@/lib/ai/client";
import { TradeForm } from "@/components/TradeForm";
import { emptyValues } from "@/lib/trade-form";
import { fmt } from "@/lib/domain/time";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function NewTradePage() {
  const s = await getSettings();
  const today = fmt(new Date(), s.inputTimezone, "yyyy-MM-dd");
  return (
    <>
      <PageHeader title="매매 기록" back="/" />
      <TradeForm
        settings={{ inputTimezone: s.inputTimezone, feeRatePct: s.feeRatePct, setupTags: s.setupTags, emotionTags: s.emotionTags }}
        initial={emptyValues(today)}
        defaultDate={today}
        aiEnabled={aiEnabled()}
      />
    </>
  );
}
