import "server-only";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../db";
import type { CashFlow } from "../domain/rules";

export const cashFlowInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["withdraw", "deposit"]),
  amountKrw: z.number().positive(),
  note: z.string().max(200).default(""),
});

export async function listCashFlows(): Promise<(CashFlow & { id: number; note: string })[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.cashFlows).orderBy(desc(schema.cashFlows.date), desc(schema.cashFlows.id));
  return rows.map((r) => ({ id: r.id, date: r.date, type: r.type, amountKrw: r.amountKrw, note: r.note }));
}

export async function addCashFlow(input: z.infer<typeof cashFlowInputSchema>) {
  const db = await getDb();
  const [row] = await db.insert(schema.cashFlows).values(input).returning({ id: schema.cashFlows.id });
  return row.id;
}

export async function deleteCashFlow(id: number) {
  const db = await getDb();
  await db.delete(schema.cashFlows).where(eq(schema.cashFlows.id, id));
}
