import { NextResponse } from "next/server";
import { buildReportInput, buildReportPrompt } from "@/lib/ai/report";
import { jsonError } from "@/lib/api";

/** Claude 앱(구독)에 붙여넣을 주간 리포트 요청문 */
export async function GET(req: Request) {
  try {
    const weekStart = new URL(req.url).searchParams.get("weekStart") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error("weekStart 형식 오류");
    const input = await buildReportInput(weekStart);
    return NextResponse.json({ start: input.start, end: input.end, prompt: buildReportPrompt(input) });
  } catch (e) {
    return jsonError(e);
  }
}
