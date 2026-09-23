import { NextResponse } from "next/server";
import { AiError, aiEnabled } from "@/lib/ai/client";
import { generateWeeklyReport, lastCompletedWeek } from "@/lib/ai/report";
import { safeEqual } from "@/lib/auth";

export const maxDuration = 300;

/** Vercel Cron 이 매주 토요일 호출. 지난주 리포트가 없을 때만 생성한다 (비용 절감) */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!aiEnabled()) return NextResponse.json({ skipped: "ANTHROPIC_API_KEY 미설정" });
  try {
    return NextResponse.json(await generateWeeklyReport(lastCompletedWeek()));
  } catch (e) {
    if (e instanceof AiError) return NextResponse.json({ skipped: e.message });
    throw e;
  }
}
