import { NextResponse } from "next/server";
import { jsonError, parseId } from "@/lib/api";
import { refreshCandles } from "@/lib/candles";

export async function POST(_: Request, ctx: RouteContext<"/api/positions/[id]/candles">) {
  try {
    return NextResponse.json(await refreshCandles(parseId((await ctx.params).id)));
  } catch (e) {
    return jsonError(e);
  }
}
