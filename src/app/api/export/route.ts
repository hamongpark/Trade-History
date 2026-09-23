import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { executionsCsv, positionsCsv } from "@/lib/export";
import { listPositions } from "@/lib/repo/positions";
import { getSettings } from "@/lib/settings";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const type = u.searchParams.get("type") ?? "positions";
  const list = await listPositions({ from: u.searchParams.get("from") ?? undefined, to: u.searchParams.get("to") ?? undefined });
  const stamp = new Date().toISOString().slice(0, 10);

  if (type === "json") {
    const db = await getDb();
    const reports = await db.select().from(schema.aiReports);
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, settings: await getSettings(), positions: list, reports }, null, 2);
    return new NextResponse(body, {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="trade-history-${stamp}.json"` },
    });
  }
  const csv = type === "executions" ? executionsCsv(list) : positionsCsv(list);
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${type}-${stamp}.csv"` },
  });
}
