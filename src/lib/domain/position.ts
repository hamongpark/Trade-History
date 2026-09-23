import type { Execution, PositionMetrics, Side } from "./types";

const EPS = 1e-9;

export function sortExecutions<T extends { executedAt: Date; side: Side }>(list: T[]): T[] {
  // 같은 분에 매수·매도가 함께 있으면 매수를 먼저 처리한다 (분 단위 입력 대응)
  return [...list].sort(
    (a, b) =>
      a.executedAt.getTime() - b.executedAt.getTime() ||
      (a.side === b.side ? 0 : a.side === "buy" ? -1 : 1),
  );
}

/** 평균단가 방식으로 롱 포지션 손익을 계산한다. */
export function computeMetrics(executions: Execution[], plannedStop: number | null = null): PositionMetrics {
  if (executions.length === 0) throw new Error("체결 내역이 없습니다");
  const fills = sortExecutions(executions);

  let qty = 0;
  let cost = 0;
  let realized = 0;
  let maxQty = 0;
  let buyQty = 0;
  let buyValue = 0;
  let sellQty = 0;
  let sellValue = 0;
  let fees = 0;
  let closedAt: Date | null = null;

  for (const f of fills) {
    fees += f.fee || 0;
    if (f.side === "buy") {
      qty += f.qty;
      cost += f.price * f.qty;
      buyQty += f.qty;
      buyValue += f.price * f.qty;
      maxQty = Math.max(maxQty, qty);
    } else {
      const avg = qty > EPS ? cost / qty : f.price;
      const q = Math.min(f.qty, qty);
      realized += (f.price - avg) * q;
      cost -= avg * q;
      qty -= q;
      sellQty += f.qty;
      sellValue += f.price * f.qty;
      if (qty <= EPS) closedAt = f.executedAt;
    }
  }

  const status = qty <= EPS && sellQty > 0 ? "closed" : "open";
  const avgEntry = buyQty > 0 ? buyValue / buyQty : 0;
  const netPnl = realized - fees;
  const basis = avgEntry * maxQty;
  const riskPerShare = plannedStop != null ? avgEntry - plannedStop : 0;
  const openedAt = fills[0].executedAt;
  const finalClosedAt = status === "closed" ? closedAt : null;

  return {
    status,
    buyQty,
    sellQty,
    openQty: Math.max(qty, 0),
    maxQty,
    avgEntry,
    avgExit: sellQty > 0 ? sellValue / sellQty : null,
    grossPnl: realized,
    fees,
    netPnl,
    returnPct: basis > 0 ? netPnl / basis : 0,
    rMultiple: riskPerShare > EPS && maxQty > 0 ? netPnl / (riskPerShare * maxQty) : null,
    openedAt,
    closedAt: finalClosedAt,
    holdSeconds: finalClosedAt ? (finalClosedAt.getTime() - openedAt.getTime()) / 1000 : null,
    fillCount: fills.length,
  };
}

export interface RawExecution extends Execution {
  ticker: string;
}

export interface GroupResult {
  groups: { ticker: string; executions: Execution[] }[];
  /** 앞선 매수 없이 등장한 매도 등, 포지션에 넣지 못한 체결 */
  orphans: RawExecution[];
}

/**
 * 여러 종목의 체결 목록을 포지션 단위로 묶는다.
 * 종목별로 보유수량이 0 → 양수가 될 때 새 포지션이 시작되고 0 으로 돌아오면 끝난다.
 */
export function groupIntoPositions(list: RawExecution[]): GroupResult {
  const byTicker = new Map<string, RawExecution[]>();
  for (const e of list) {
    const t = e.ticker.trim().toUpperCase();
    byTicker.set(t, [...(byTicker.get(t) ?? []), { ...e, ticker: t }]);
  }
  const groups: GroupResult["groups"] = [];
  const orphans: RawExecution[] = [];
  for (const [ticker, fills] of byTicker) {
    let current: Execution[] | null = null;
    let qty = 0;
    for (const f of sortExecutions(fills)) {
      const { ticker: _t, ...exec } = f;
      void _t;
      if (f.side === "buy") {
        if (!current) {
          current = [];
          groups.push({ ticker, executions: current });
        }
        current.push(exec);
        qty += f.qty;
      } else {
        if (!current || qty <= EPS) {
          orphans.push(f);
          continue;
        }
        current.push(exec);
        qty -= f.qty;
        if (qty <= EPS) {
          current = null;
          qty = 0;
        }
      }
    }
  }
  groups.sort((a, b) => a.executions[0].executedAt.getTime() - b.executions[0].executedAt.getTime());
  return { groups, orphans };
}
