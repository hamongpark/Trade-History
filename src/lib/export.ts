import { ET, KST, fmt } from "./domain/time";
import type { PositionView } from "./domain/types";

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = Array.isArray(v) ? v.join("|") : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  // 엑셀에서 한글이 깨지지 않도록 BOM 추가
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function positionsCsv(list: PositionView[]): string {
  const header = [
    "id", "ticker", "trade_date_et", "opened_kst", "closed_kst", "opened_et", "closed_et", "status", "hold_sec",
    "fills", "max_qty", "avg_entry", "avg_exit", "gross_pnl_usd", "fees_usd", "net_pnl_usd", "fx_rate", "net_pnl_krw", "return_pct", "r_multiple",
    "stop_pct", "target_pct", "setup_tags", "emotion_tags", "confidence", "followed_plan",
    "entry_reason", "exit_reason", "note", "mae_pct", "mfe_pct", "post_exit_high_pct", "pre_entry_change_pct",
  ];
  const rows = list.map((p) => {
    const m = p.metrics;
    const e = p.excursion;
    return [
      p.id, p.ticker, p.tradeDate, fmt(m.openedAt, KST, "yyyy-MM-dd HH:mm"), m.closedAt && fmt(m.closedAt, KST, "yyyy-MM-dd HH:mm"),
      fmt(m.openedAt, ET, "yyyy-MM-dd HH:mm"), m.closedAt && fmt(m.closedAt, ET, "yyyy-MM-dd HH:mm"), m.status, m.holdSeconds,
      m.fillCount, m.maxQty, m.avgEntry.toFixed(4), m.avgExit?.toFixed(4), m.grossPnl.toFixed(2), m.fees.toFixed(2),
      m.netPnl.toFixed(2), p.fxRate, Math.round(p.krw.net), (m.returnPct * 100).toFixed(3), m.rMultiple?.toFixed(2), p.stopPct, p.targetPct,
      p.setupTags, p.emotionTags, p.confidence, p.followedPlan, p.entryReason, p.exitReason, p.note,
      e && (e.maePct * 100).toFixed(3), e && (e.mfePct * 100).toFixed(3),
      e?.postExitHighPct != null ? (e.postExitHighPct * 100).toFixed(3) : null,
      e?.preEntryChangePct != null ? (e.preEntryChangePct * 100).toFixed(3) : null,
    ];
  });
  return toCsv(header, rows);
}

export function executionsCsv(list: PositionView[]): string {
  const header = ["position_id", "ticker", "side", "executed_utc", "executed_kst", "executed_et", "price", "qty", "fee"];
  const rows = list.flatMap((p) =>
    p.executions.map((e) => [
      p.id, p.ticker, e.side, e.executedAt.toISOString(), fmt(e.executedAt, KST, "yyyy-MM-dd HH:mm"),
      fmt(e.executedAt, ET, "yyyy-MM-dd HH:mm"), e.price, e.qty, e.fee,
    ]),
  );
  return toCsv(header, rows);
}
