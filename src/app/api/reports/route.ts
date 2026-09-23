import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, aiEnabled } from "@/lib/ai/client";
import { generateWeeklyReport } from "@/lib/ai/report";
import { jsonError } from "@/lib/api";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    if (!aiEnabled()) throw new AiError("ANTHROPIC_API_KEY 가 설정되지 않았습니다");
    const body = z
      .object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), force: z.boolean().optional() })
      .parse(await req.json());
    return NextResponse.json(await generateWeeklyReport(body.weekStart, { force: body.force }));
  } catch (e) {
    return jsonError(e);
  }
}
