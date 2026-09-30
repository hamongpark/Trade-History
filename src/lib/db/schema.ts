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
    /** 계획 손절율 (%, 평균 매수가 대비 하락폭. 1.5 = -1.5%) */
    stopPct: doublePrecision("stop_pct"),
    /** 계획 목표율 (%, 평균 매수가 대비 상승폭) */
    targetPct: doublePrecision("target_pct"),
    /** 적용 환율 (원/달러). 거래일 기준으로 저장, 수동 수정 가능 */
    fxRate: doublePrecision("fx_rate"),
    setupTags: text("setup_tags").array().notNull().default([]),
    emotionTags: text("emotion_tags").array().notNull().default([]),
    confidence: integer("confidence"),
    followedPlan: boolean("followed_plan"),
    /** 손절선 도달·손실 시 자가 체크: 다시 봐도 진입할 자리였나 */
    wouldReenter: boolean("would_reenter"),
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

/** 일별 USD/KRW 환율 캐시 */
export const fxRates = pgTable("fx_rates", {
  date: text("date").primaryKey(),
  rate: doublePrecision("rate").notNull(),
  /** 공급자가 실제로 반환한 기준일 (주말·휴일이면 직전 영업일) */
  rateDate: text("rate_date").notNull(),
  source: text("source").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 입출금 기록 (룰 ⑤ 초과분 인출) */
export const cashFlows = pgTable("cash_flows", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  type: text("type", { enum: ["withdraw", "deposit"] }).notNull(),
  amountKrw: doublePrecision("amount_krw").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
