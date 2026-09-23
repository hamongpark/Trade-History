import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** 하나의 포지션(진입 → 완전 청산). 분할 매수·매도는 executions 로 표현한다. */
export const positions = pgTable(
  "positions",
  {
    id: serial("id").primaryKey(),
    ticker: text("ticker").notNull(),
    /** 첫 체결의 미국 동부시간(ET) 기준 거래일 (YYYY-MM-DD) */
    tradeDate: text("trade_date").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    plannedStop: doublePrecision("planned_stop"),
    plannedTarget: doublePrecision("planned_target"),
    setupTags: text("setup_tags").array().notNull().default([]),
    emotionTags: text("emotion_tags").array().notNull().default([]),
    confidence: integer("confidence"),
    followedPlan: boolean("followed_plan"),
    entryReason: text("entry_reason").notNull().default(""),
    exitReason: text("exit_reason").notNull().default(""),
    note: text("note").notNull().default(""),
    /** 분봉 캐시 상태: none | ok | error */
    candlesStatus: text("candles_status").notNull().default("none"),
    candlesError: text("candles_error"),
    /** 분봉 기반 지표 캐시 (MAE/MFE 등). candles 저장 시 갱신 */
    excursion: jsonb("excursion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("positions_trade_date_idx").on(t.tradeDate), index("positions_ticker_idx").on(t.ticker)],
);

export const executions = pgTable(
  "executions",
  {
    id: serial("id").primaryKey(),
    positionId: integer("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    side: text("side", { enum: ["buy", "sell"] }).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
    price: doublePrecision("price").notNull(),
    qty: doublePrecision("qty").notNull(),
    fee: doublePrecision("fee").notNull().default(0),
  },
  (t) => [index("executions_position_idx").on(t.positionId)],
);

/** 1분봉 캐시. 무료 API 는 과거 분봉 보관 기간이 짧아 기록 시점에 받아 저장한다. */
export const candles = pgTable(
  "candles_1m",
  {
    ticker: text("ticker").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    open: doublePrecision("open").notNull(),
    high: doublePrecision("high").notNull(),
    low: doublePrecision("low").notNull(),
    close: doublePrecision("close").notNull(),
    volume: doublePrecision("volume").notNull(),
    source: text("source").notNull(),
  },
  (t) => [primaryKey({ columns: [t.ticker, t.ts] })],
);

export const aiReports = pgTable("ai_reports", {
  id: serial("id").primaryKey(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  model: text("model").notNull(),
  content: text("content").notNull(),
  focus: text("focus").notNull().default(""),
  stats: jsonb("stats"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
