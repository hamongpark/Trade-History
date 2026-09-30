import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { getSettings, saveSettings } from "@/lib/settings";

const patchSchema = z
  .object({
    inputTimezone: z.string(),
    displayTimezone: z.string(),
    feeRatePct: z.number().min(0).max(5),
    dailyLossLimitKrw: z.number().min(0),
    maxTradesPerDay: z.number().int().min(1).max(100),
    defaultStopPct: z.number().positive().max(100).nullable(),
    defaultTargetPct: z.number().positive().max(1000).nullable(),
    setupTags: z.array(z.string().trim().min(1)).max(40),
    emotionTags: z.array(z.string().trim().min(1)).max(40),
  })
  .partial();

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function PUT(req: Request) {
  try {
    return NextResponse.json(await saveSettings(patchSchema.parse(await req.json())));
  } catch (e) {
    return jsonError(e);
  }
}
