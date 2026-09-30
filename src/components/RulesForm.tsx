"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RULES, describeRule, type RuleConfig, type RuleId } from "@/lib/domain/rules";

type Draft = Record<Exclude<keyof RuleConfig, "enabled" | "capitalStartDate">, string> & { capitalStartDate: string };

const toDraft = (c: RuleConfig): Draft => ({
  capitalKrw: String(c.capitalKrw),
  dailyTargetPct: String(c.dailyTargetPct),
  bigLossPct: String(c.bigLossPct),
  cutoffSummer: c.cutoffSummer,
  cutoffWinter: c.cutoffWinter,
  blackoutBeforeMin: String(c.blackoutBeforeMin),
  blackoutAfterMin: String(c.blackoutAfterMin),
  stopGraceMin: String(c.stopGraceMin),
  withdrawTriggerPct: String(c.withdrawTriggerPct),
  capitalStartDate: c.capitalStartDate ?? "",
});

/** 룰별 편집 항목 */
const FIELDS: Partial<Record<RuleId, { key: keyof Draft; label: string; type?: "time" | "date" }[]>> = {
  lateCutoff: [
    { key: "cutoffSummer", label: "여름 마감", type: "time" },
    { key: "cutoffWinter", label: "겨울 마감", type: "time" },
  ],
  bigLossStop: [{ key: "bigLossPct", label: "손실 기준 (−%)" }],
  openBlackout: [
    { key: "blackoutBeforeMin", label: "개장 전 (분)" },
    { key: "blackoutAfterMin", label: "개장 후 (분)" },
  ],
  dailyTarget: [{ key: "dailyTargetPct", label: "목표 (거래 자금 대비 %)" }],
  withdraw: [
    { key: "withdrawTriggerPct", label: "인출 기준 (+%)" },
    { key: "capitalStartDate", label: "잔고 계산 시작일", type: "date" },
  ],
  stopDiscipline: [{ key: "stopGraceMin", label: "손절선 도달 후 허용 (분)" }],
};

export function RulesForm({ initial }: { initial: RuleConfig }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [d, setD] = useState<Draft>(toDraft(initial));
  const [msg, setMsg] = useState<string | null>(null);

  const config = (): RuleConfig => ({
    enabled,
    capitalKrw: Number(d.capitalKrw),
    dailyTargetPct: Number(d.dailyTargetPct),
    bigLossPct: Number(d.bigLossPct),
    cutoffSummer: d.cutoffSummer,
    cutoffWinter: d.cutoffWinter,
    blackoutBeforeMin: Number(d.blackoutBeforeMin),
    blackoutAfterMin: Number(d.blackoutAfterMin),
    stopGraceMin: Number(d.stopGraceMin),
    withdrawTriggerPct: Number(d.withdrawTriggerPct),
    capitalStartDate: d.capitalStartDate || null,
  });

  async function save() {
    setMsg(null);
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules: config() }) });
    setMsg(res.ok ? "저장했습니다" : ((await res.json()).error ?? "저장 실패"));
    router.refresh();
  }

  let preview: RuleConfig | null = null;
  try {
    preview = config();
  } catch {
    preview = null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-2">거래 자금 (원)</span>
        <input className="input tnum" inputMode="numeric" value={d.capitalKrw} onChange={(e) => setD({ ...d, capitalKrw: e.target.value.replace(/[^0-9]/g, "") })} />
      </div>
      <ol className="flex flex-col gap-3">
        {RULES.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {"①②③④⑤⑥⑦"[r.no - 1]} {r.title}
                </p>
                {preview && <p className="mt-0.5 text-xs text-ink-2">{describeRule(r.id, preview)}</p>}
              </div>
              <button
                className="chip shrink-0 !px-3 !py-1 text-xs"
                data-on={enabled[r.id]}
                onClick={() => setEnabled({ ...enabled, [r.id]: !enabled[r.id] })}
                aria-pressed={enabled[r.id]}
              >
                {enabled[r.id] ? "켜짐" : "꺼짐"}
              </button>
            </div>
            {FIELDS[r.id] && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {FIELDS[r.id]!.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1">
                    <span className="text-[11px] text-ink-3">{f.label}</span>
                    <input
                      className="input !py-2 text-sm"
                      type={f.type ?? "text"}
                      inputMode={f.type ? undefined : "decimal"}
                      value={d[f.key]}
                      onChange={(e) => setD({ ...d, [f.key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <button className="btn btn-primary" onClick={save}>
        룰 저장
      </button>
      {msg && <p className="text-center text-sm text-ink-2">{msg}</p>}
    </div>
  );
}
