"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CLAUDE_APP_URL, copyText } from "@/lib/clipboard";

type Week = { start: string; label: string; exists: boolean };

export function GenerateReport({ weeks, enabled }: { weeks: Week[]; enabled: boolean }) {
  const router = useRouter();
  const [week, setWeek] = useState(weeks[1]?.start ?? weeks[0]?.start ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const selected = weeks.find((w) => w.start === week);

  async function copyPrompt() {
    setErr(null);
    setBusy("요청문 만드는 중…");
    const res = await fetch(`/api/reports/prompt?weekStart=${week}`);
    const json = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(json.error ?? "요청문 생성 실패");
    const ok = await copyText(json.prompt);
    setCopied(ok);
    setFallback(ok ? null : json.prompt);
  }

  async function saveAnswer() {
    if (selected?.exists && !confirm("이미 리포트가 있는 주간입니다. 붙여넣은 내용으로 바꿀까요?")) return;
    setErr(null);
    setBusy("저장 중…");
    const res = await fetch("/api/reports/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weekStart: week, text: answer }) });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(json.error ?? "저장 실패");
    router.push(`/reports/${json.id}`);
    router.refresh();
  }

  async function runApi() {
    if (selected?.exists && !confirm("이미 생성된 주간입니다. 다시 생성할까요? (API 비용 발생)")) return;
    setBusy("AI 가 한 주 매매를 분석하고 있습니다 (30초~2분)");
    setErr(null);
    const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weekStart: week, force: selected?.exists }) });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(json.error ?? "생성 실패");
    router.push(`/reports/${json.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <select className="input" value={week} onChange={(e) => { setWeek(e.target.value); setCopied(false); setFallback(null); }}>
        {weeks.map((w) => (
          <option key={w.start} value={w.start}>
            {w.label}
            {w.exists ? " (생성됨)" : ""}
          </option>
        ))}
      </select>

      <ol className="flex flex-col gap-3 text-sm">
        <li className="flex flex-col gap-2">
          <span className="text-ink-2">① 요청문을 복사해서 Claude 앱 새 대화에 붙여넣기</span>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" onClick={copyPrompt} disabled={!!busy || !week}>
              {copied ? "✓ 복사됨" : "요청문 복사"}
            </button>
            <a className="btn btn-ghost text-center" href={CLAUDE_APP_URL} target="_blank" rel="noreferrer">
              Claude 열기 ↗
            </a>
          </div>
          {fallback && (
            <textarea className="input min-h-24 text-xs" readOnly value={fallback} onFocus={(e) => e.currentTarget.select()} aria-label="요청문 (길게 눌러 복사)" />
          )}
        </li>
        <li className="flex flex-col gap-2">
          <span className="text-ink-2">② Claude 답변 전체를 복사해서 붙여넣고 저장</span>
          <textarea className="input min-h-28" placeholder="집중할 한 가지: …" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <button className="btn btn-primary" onClick={saveAnswer} disabled={!!busy || answer.trim().length < 20}>
            리포트 저장
          </button>
        </li>
      </ol>

      {enabled && (
        <button className="text-xs text-ink-3 underline" onClick={runApi} disabled={!!busy}>
          API 로 자동 생성 (비용 발생)
        </button>
      )}
      {busy && <p className="text-xs text-ink-3">{busy}</p>}
      {err && <p className="text-sm text-warn">{err}</p>}
    </div>
  );
}
