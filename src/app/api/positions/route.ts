import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { refreshCandlesWithTimeout } from "@/lib/candles";
import { createPosition, listPositions, positionInputSchema } from "@/lib/repo/positions";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const list = await listPositions({
    from: u.searchParams.get("from") ?? undefined,
    to: u.searchParams.get("to") ?? undefined,
    ticker: u.searchParams.get("ticker") ?? undefined,
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  try {
    const input = positionInputSchema.parse(await req.json());
    const id = await createPosition(input);
    const candles = await refreshCandlesWithTimeout(id);
    return NextResponse.json({ id, candles });
  } catch (e) {
    return jsonError(e);
  }
}
