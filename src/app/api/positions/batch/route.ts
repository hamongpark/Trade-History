import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { refreshCandlesWithTimeout } from "@/lib/candles";
import { createPosition, positionInputSchema } from "@/lib/repo/positions";

export const maxDuration = 60;

/** 캡처 가져오기에서 여러 포지션을 한 번에 저장 */
export async function POST(req: Request) {
  try {
    const inputs = z.array(positionInputSchema).min(1).max(50).parse(await req.json());
    const ids: number[] = [];
    for (const input of inputs) ids.push(await createPosition(input));
    await Promise.all(ids.map((id) => refreshCandlesWithTimeout(id, 20000)));
    return NextResponse.json({ ids });
  } catch (e) {
    return jsonError(e);
  }
}
