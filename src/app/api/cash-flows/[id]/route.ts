import { NextResponse } from "next/server";
import { jsonError, parseId } from "@/lib/api";
import { deleteCashFlow } from "@/lib/repo/cashflows";

export async function DELETE(_: Request, ctx: RouteContext<"/api/cash-flows/[id]">) {
  try {
    await deleteCashFlow(parseId((await ctx.params).id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
