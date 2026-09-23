import { NextResponse } from "next/server";
import { jsonError, parseId } from "@/lib/api";
import { refreshCandlesWithTimeout } from "@/lib/candles";
import { deletePosition, getPosition, positionInputSchema, updatePosition } from "@/lib/repo/positions";

export async function GET(_: Request, ctx: RouteContext<"/api/positions/[id]">) {
  const p = await getPosition(parseId((await ctx.params).id));
  return p ? NextResponse.json(p) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function PUT(req: Request, ctx: RouteContext<"/api/positions/[id]">) {
  try {
    const id = parseId((await ctx.params).id);
    await updatePosition(id, positionInputSchema.parse(await req.json()));
    const candles = await refreshCandlesWithTimeout(id);
    return NextResponse.json({ id, candles });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(_: Request, ctx: RouteContext<"/api/positions/[id]">) {
  try {
    await deletePosition(parseId((await ctx.params).id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
