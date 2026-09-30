import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseId } from "@/lib/api";
import { setWouldReenter } from "@/lib/repo/positions";

/** 룰 ⑥ 자가 체크: 다시 봐도 진입할 자리였나 */
export async function POST(req: Request, ctx: RouteContext<"/api/positions/[id]/self-check">) {
  try {
    const { wouldReenter } = z.object({ wouldReenter: z.boolean().nullable() }).parse(await req.json());
    await setWouldReenter(parseId((await ctx.params).id), wouldReenter);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
