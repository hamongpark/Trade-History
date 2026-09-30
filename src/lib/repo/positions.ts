import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db";
import { buildView, computeMetrics } from "../domain/position";
import { etDate } from "../domain/time";
import type { Excursion, PositionRecord, PositionView } from "../domain/types";
import { getUsdKrw } from "../fx";
import { getSettings } from "../settings";

export const executionInputSchema = z.object({
  side: z.enum(["buy", "sell"]),
  executedAt: z.coerce.date(),
  price: z.number().positive(),
  qty: z.number().positive(),
  /** 비워두면 설정의 수수료율로 자동 계산 */
  fee: z.number().min(0).nullable().optional(),
});

export const positionInputSchema = z.object({
  ticker: z.string().trim().min(1).max(12).transform((s) => s.toUpperCase()),
  /** 손절율 % (평균 매수가 대비 하락폭) */
  stopPct: z.number().positive().max(100).nullable().optional(),
  /** 목표율 % (평균 매수가 대비 상승폭) */
  targetPct: z.number().positive().max(1000).nullable().optional(),
  /** 적용 환율 (원/달러). 비우면 거래일 기준환율 자동 적용 */
  fxRate: z.number().positive().max(10000).nullable().optional(),
  setupTags: z.array(z.string()).default([]),
  emotionTags: z.array(z.string()).default([]),
  confidence: z.number().int().min(1).max(5).nullable().optional(),
  followedPlan: z.boolean().nullable().optional(),
  entryReason: z.string().default(""),
  exitReason: z.string().default(""),
  note: z.string().default(""),
  executions: z.array(executionInputSchema).min(1),
});
export type PositionInput = z.infer<typeof positionInputSchema>;

type PositionRow = typeof schema.positions.$inferSelect;
type ExecutionRow = typeof schema.executions.$inferSelect;

function toView(row: PositionRow, execs: ExecutionRow[], fx: { rate: number; provisional: boolean }): PositionView {
  const executions = execs.map((e) => ({
    id: e.id,
    side: e.side,
    executedAt: e.executedAt,
    price: e.price,
    qty: e.qty,
    fee: e.fee,
  }));
  const record: PositionRecord = {
    id: row.id,
    ticker: row.ticker,
    tradeDate: row.tradeDate,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    stopPct: row.stopPct,
    targetPct: row.targetPct,
    fxRate: fx.rate,
    fxProvisional: fx.provisional,
    setupTags: row.setupTags,
    emotionTags: row.emotionTags,
    confidence: row.confidence,
    followedPlan: row.followedPlan,
    entryReason: row.entryReason,
    exitReason: row.exitReason,
    note: row.note,
    candlesStatus: row.candlesStatus,
    candlesError: row.candlesError,
    excursion: (row.excursion as Excursion | null) ?? null,
    executions,
  };
  return buildView(record);
}

/** 환율이 비어 있는 포지션은 거래일 환율을 조회해 채운다 (확정값만 저장) */
async function resolveFx(rows: PositionRow[]) {
  const db = await getDb();
  const byDate = new Map<string, { rate: number; provisional: boolean }>();
  for (const date of new Set(rows.filter((r) => r.fxRate == null).map((r) => r.tradeDate))) {
    const q = await getUsdKrw(date);
    byDate.set(date, q);
    if (!q.provisional)
      await db
        .update(schema.positions)
        .set({ fxRate: q.rate })
        .where(and(eq(schema.positions.tradeDate, date), isNull(schema.positions.fxRate)));
  }
  return (r: PositionRow) => (r.fxRate != null ? { rate: r.fxRate, provisional: false } : byDate.get(r.tradeDate)!);
}

async function attach(rows: PositionRow[]): Promise<PositionView[]> {
  if (rows.length === 0) return [];
  const db = await getDb();
  const execs = await db
    .select()
    .from(schema.executions)
    .where(inArray(schema.executions.positionId, rows.map((r) => r.id)))
    .orderBy(asc(schema.executions.executedAt), asc(schema.executions.id));
  const byPos = new Map<number, ExecutionRow[]>();
  for (const e of execs) byPos.set(e.positionId, [...(byPos.get(e.positionId) ?? []), e]);
  const fxOf = await resolveFx(rows);
  return rows.filter((r) => byPos.has(r.id)).map((r) => toView(r, byPos.get(r.id)!, fxOf(r)));
}

export async function listPositions(opts: { from?: string; to?: string; ticker?: string } = {}): Promise<PositionView[]> {
  const db = await getDb();
  const conds = [];
  if (opts.from) conds.push(gte(schema.positions.tradeDate, opts.from));
  if (opts.to) conds.push(lte(schema.positions.tradeDate, opts.to));
  if (opts.ticker) conds.push(eq(schema.positions.ticker, opts.ticker.toUpperCase()));
  const rows = await db
    .select()
    .from(schema.positions)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.positions.openedAt));
  return attach(rows);
}

export async function getPosition(id: number): Promise<PositionView | null> {
  const db = await getDb();
  const rows = await db.select().from(schema.positions).where(eq(schema.positions.id, id));
  return (await attach(rows))[0] ?? null;
}

async function normalize(input: PositionInput) {
  const { feeRatePct } = await getSettings();
  const executions = input.executions.map((e) => ({
    side: e.side,
    executedAt: e.executedAt,
    price: e.price,
    qty: e.qty,
    fee: e.fee ?? Math.round(e.price * e.qty * feeRatePct) / 100, // 센트 단위 반올림
  }));
  const metrics = computeMetrics(executions, input.stopPct ?? null);
  const tradeDate = etDate(metrics.openedAt);
  let fxRate = input.fxRate ?? null;
  if (fxRate == null) {
    const q = await getUsdKrw(tradeDate);
    if (!q.provisional) fxRate = q.rate;
  }
  const values = {
    ticker: input.ticker,
    tradeDate,
    openedAt: metrics.openedAt,
    closedAt: metrics.closedAt,
    stopPct: input.stopPct ?? null,
    targetPct: input.targetPct ?? null,
    fxRate,
    setupTags: input.setupTags,
    emotionTags: input.emotionTags,
    confidence: input.confidence ?? null,
    followedPlan: input.followedPlan ?? null,
    entryReason: input.entryReason,
    exitReason: input.exitReason,
    note: input.note,
  };
  return { values, executions };
}

export async function createPosition(input: PositionInput): Promise<number> {
  const db = await getDb();
  const { values, executions } = await normalize(input);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(schema.positions).values(values).returning({ id: schema.positions.id });
    await tx.insert(schema.executions).values(executions.map((e) => ({ ...e, positionId: row.id })));
    return row.id;
  });
}

export async function updatePosition(id: number, input: PositionInput): Promise<void> {
  const db = await getDb();
  const { values, executions } = await normalize(input);
  await db.transaction(async (tx) => {
    await tx
      .update(schema.positions)
      .set({ ...values, updatedAt: new Date(), candlesStatus: "none", excursion: null })
      .where(eq(schema.positions.id, id));
    await tx.delete(schema.executions).where(eq(schema.executions.positionId, id));
    await tx.insert(schema.executions).values(executions.map((e) => ({ ...e, positionId: id })));
  });
}

export async function deletePosition(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(schema.positions).where(eq(schema.positions.id, id));
}

/** 매수/매도 사유가 비어 있는 포지션 수 (캡처로 일괄 등록 후 미작성 알림용) */
export async function countIncomplete(): Promise<number> {
  const db = await getDb();
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.positions)
    .where(sql`${schema.positions.entryReason} = '' or ${schema.positions.exitReason} = ''`);
  return r?.n ?? 0;
}

export async function setCandleState(id: number, status: string, error: string | null, excursion: Excursion | null) {
  const db = await getDb();
  await db
    .update(schema.positions)
    .set({ candlesStatus: status, candlesError: error, excursion })
    .where(eq(schema.positions.id, id));
}
