import { RULES, type RuleResult } from "@/lib/domain/rules";
import type { PositionView } from "@/lib/domain/types";
import { SelfCheck } from "./SelfCheck";

const NUM = "①②③④⑤⑥⑦";

/** 매매 상세: 룰 판정 결과 */
export function RuleChecks({ p, results, enabled }: { p: PositionView; results: RuleResult[]; enabled: Record<string, boolean> }) {
  const byRule = new Map(results.map((r) => [r.rule, r]));
  const needsSelfCheck =
    p.stopPct != null && ((p.excursion?.stopHitDelayMin ?? null) !== null || (p.metrics.status === "closed" && p.metrics.netPnl < 0));
  const rows = RULES.filter((r) => r.id !== "withdraw" && enabled[r.id]);
  const bad = results.filter((r) => r.kind === "violation").length;
  return (
    <section className={`card p-4 ${bad ? "border-warn/60" : ""}`}>
      <p className="mb-2 text-sm font-semibold">
        룰 체크{" "}
        <span className={`text-xs font-normal ${bad ? "text-warn" : "text-ink-3"}`}>{bad ? `위반 ${bad}건` : "모두 준수"}</span>
      </p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {rows.map((r) => {
          const res = byRule.get(r.id);
          const icon = !res ? "✓" : res.kind === "violation" ? "⚠" : "?";
          const color = !res ? "text-ink-3" : res.kind === "violation" ? "text-warn" : "text-accent";
          return (
            <li key={r.id} className="flex gap-2">
              <span className={`w-4 shrink-0 text-center ${color}`}>{icon}</span>
              <span className={res ? "text-ink" : "text-ink-3"}>
                {NUM[r.no - 1]} {r.title}
                {res && <span className="block text-xs text-ink-2">{res.message}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {needsSelfCheck && enabled.stopDiscipline && (
        <div className="mt-3 border-t border-border pt-3">
          <SelfCheck id={p.id} value={p.wouldReenter} />
        </div>
      )}
    </section>
  );
}
