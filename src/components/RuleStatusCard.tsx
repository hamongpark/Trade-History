import Link from "next/link";
import type { DayStatus } from "@/lib/domain/rules";
import { won, wonCompact } from "@/lib/format";

const ICON: Record<DayStatus["state"], string> = { open: "🟢", blackout: "⏸", cutoff: "🌙", ended: "⛔", closed: "💤" };

/** 홈 상단: 지금 매매해도 되는지 + 오늘 목표 진행률 */
export function RuleStatusCard({ status, violationsToday, bigLossPct }: { status: DayStatus; violationsToday: number; bigLossPct: number }) {
  const progress = status.targetKrw > 0 ? Math.max(0, Math.min(1, status.netKrw / status.targetKrw)) : 0;
  const tone =
    status.state === "open" || status.state === "closed"
      ? "border-border"
      : status.state === "ended"
        ? "border-warn/60 bg-warn/10"
        : "border-accent/50 bg-accent/10";
  return (
    <section className={`card flex flex-col gap-3 p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">
            <span aria-hidden>{ICON[status.state]}</span> {status.title}
          </p>
          <p className="text-xs text-ink-2">{status.detail}</p>
        </div>
        <Link href="/settings#rules" className="shrink-0 text-xs text-ink-3">
          룰 보기 ›
        </Link>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-ink-2">일일 목표</span>
          <span className="tnum text-ink-2">
            {won(status.netKrw)} / {wonCompact(status.targetKrw).replace("+", "")}
          </span>
        </div>
        <div className="h-2 rounded bg-surface-2">
          <div className="h-2 rounded bg-profit" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-ink-3">−{bigLossPct}% 이상 손실 매매가 나오면 그날은 종료</p>
      </div>
      {violationsToday > 0 && (
        <Link href="/trades" className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">
          ⚠ 오늘 룰 위반 {violationsToday}건 — 확인하기 ›
        </Link>
      )}
    </section>
  );
}
