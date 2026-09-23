"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function GenerateReport({ weeks, enabled }: { weeks: { start: string; label: string; exists: boolean }[]; enabled: boolean }) {
  const router = useRouter();
  const [week, setWeek] = useState(weeks[0]?.start ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const selected = weeks.find((w) => w.start === week);

  async function run() {
    if (selected?.exists && !confirm("이미 생성된 주간입니다. 다시 생성할까요? (API 비용 발생)")) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weekStart: week, force: selected?.exists }) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(json.error ?? "생성 실패");
    router.push(`/reports/${json.id}`);
    router.refresh();
  }

  if (!enabled) return <p className="text-sm text-ink-3">ANTHROPIC_API_KEY 를 설정하면 AI 리포트를 만들 수 있습니다.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select className="input" value={week} onChange={(e) => setWeek(e.target.value)}>
          {weeks.map((w) => (
            <option key={w.start} value={w.start}>
              {w.label}
              {w.exists ? " (생성됨)" : ""}
            </option>
          ))}
        </select>
        <button className="btn btn-primary shrink-0" onClick={run} disabled={busy || !week}>
          {busy ? "작성 중…" : "생성"}
        </button>
      </div>
      {busy && <p className="text-xs text-ink-3">AI 가 한 주 매매를 분석하고 있습니다 (30초~2분)</p>}
      {err && <p className="text-sm text-warn">{err}</p>}
    </div>
  );
}
