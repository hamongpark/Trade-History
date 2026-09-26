import { NextResponse } from "next/server";
import { z } from "zod";
import { saveManualReport } from "@/lib/ai/report";
import { jsonError } from "@/lib/api";

/** Claude 앱에서 받은 리포트 답변을 붙여넣어 저장 */
export async function POST(req: Request) {
  try {
    const body = z
      .object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), text: z.string().min(20).max(100_000) })
      .parse(await req.json());
    return NextResponse.json(await saveManualReport(body.weekStart, body.text));
  } catch (e) {
    return jsonError(e);
  }
}
