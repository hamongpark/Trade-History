"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface S {
  inputTimezone: string;
  displayTimezone: string;
  feeRatePct: number;
  dailyLossLimitKrw: number;
  maxTradesPerDay: number;
  defaultStopPct: number | null;
  defaultTargetPct: number | null;
  setupTags: string[];
  emotionTags: string[];
}

const TZ = [
  ["Asia/Seoul", "한국시간 (KST)"],
  ["America/New_York", "미국 동부 (ET)"],
];

export function SettingsForm({ initial }: { initial: S }) {
  const router = useRouter();
  const [s, setS] = useState({
    ...initial,
    setupText: initial.setupTags.join(", "),
    emotionText: initial.emotionTags.join(", "),
    stopText: initial.defaultStopPct?.toString() ?? "",
    targetText: initial.defaultTargetPct?.toString() ?? "",
  });
  const optNum = (t: string) => (t.trim() === "" ? null : Number(t));
  const [msg, setMsg] = useState<string | null>(null);
  const split = (t: string) => [...new Set(t.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))];

  async function save() {
    setMsg(null);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputTimezone: s.inputTimezone,
        displayTimezone: s.displayTimezone,
        feeRatePct: Number(s.feeRatePct),
        dailyLossLimitKrw: Number(s.dailyLossLimitKrw),
        maxTradesPerDay: Number(s.maxTradesPerDay),
        defaultStopPct: optNum(s.stopText),
        defaultTargetPct: optNum(s.targetText),
        setupTags: split(s.setupText),
        emotionTags: split(s.emotionText),
      }),
    });
    setMsg(res.ok ? "저장했습니다" : "저장 실패");
    router.refresh();
  }

  const row = "flex flex-col gap-1.5";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className={row}>
          <span className="text-sm text-ink-2">입력 시간대</span>
          <select className="input" value={s.inputTimezone} onChange={(e) => setS({ ...s, inputTimezone: e.target.value })}>
            {TZ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className={row}>
          <span className="text-sm text-ink-2">표시 시간대</span>
          <select className="input" value={s.displayTimezone} onChange={(e) => setS({ ...s, displayTimezone: e.target.value })}>
            {TZ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className={row}>
          <span className="text-sm text-ink-2">수수료율 %</span>
          <input className="input" inputMode="decimal" value={s.feeRatePct} onChange={(e) => setS({ ...s, feeRatePct: e.target.value as unknown as number })} />
        </div>
        <div className={row}>
          <span className="text-sm text-ink-2">일 손실 한도 (원)</span>
          <input className="input" inputMode="decimal" value={s.dailyLossLimitKrw} onChange={(e) => setS({ ...s, dailyLossLimitKrw: e.target.value as unknown as number })} />
        </div>
        <div className={row}>
          <span className="text-sm text-ink-2">일 최대 매매</span>
          <input className="input" inputMode="numeric" value={s.maxTradesPerDay} onChange={(e) => setS({ ...s, maxTradesPerDay: e.target.value as unknown as number })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className={row}>
          <span className="text-sm text-ink-2">기본 손절율 (−%)</span>
          <input className="input" inputMode="decimal" placeholder="예: 10" value={s.stopText} onChange={(e) => setS({ ...s, stopText: e.target.value })} />
        </div>
        <div className={row}>
          <span className="text-sm text-ink-2">기본 목표율 (+%)</span>
          <input className="input" inputMode="decimal" placeholder="예: 3" value={s.targetText} onChange={(e) => setS({ ...s, targetText: e.target.value })} />
        </div>
      </div>
      <div className={row}>
        <span className="text-sm text-ink-2">셋업 태그 (쉼표로 구분)</span>
        <textarea className="input min-h-20" value={s.setupText} onChange={(e) => setS({ ...s, setupText: e.target.value })} />
      </div>
      <div className={row}>
        <span className="text-sm text-ink-2">감정/상태 태그 (쉼표로 구분)</span>
        <textarea className="input min-h-16" value={s.emotionText} onChange={(e) => setS({ ...s, emotionText: e.target.value })} />
      </div>
      <button className="btn btn-primary" onClick={save}>저장</button>
      {msg && <p className="text-center text-sm text-ink-2">{msg}</p>}
    </div>
  );
}
