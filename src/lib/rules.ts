import "server-only";
import { evaluateRules } from "./domain/rules";
import type { PositionView } from "./domain/types";
import { listPositions } from "./repo/positions";
import { getSettings } from "./settings";

/**
 * 룰 판정은 같은 거래일의 앞선 매매에 따라 달라지므로, 대상 포지션들의 거래일 전체를 함께 불러와 판정한다.
 */
export async function rulesFor(positions: PositionView[]) {
  const { rules } = await getSettings();
  if (positions.length === 0) return { rules, results: evaluateRules([], rules) };
  const dates = positions.map((p) => p.tradeDate).sort();
  const context = await listPositions({ from: dates[0], to: dates[dates.length - 1] });
  const ids = new Set(positions.map((p) => p.id));
  const all = [...context.filter((p) => !ids.has(p.id)), ...positions];
  return { rules, results: evaluateRules(all, rules) };
}
