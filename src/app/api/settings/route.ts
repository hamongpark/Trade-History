import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { getSettings, saveSettings } from "@/lib/settings";

const patchSchema = z
  .object({
    inputTimezone: z.string(),
    displayTimezone: z.string(),
    feeRatePct: z.number().min(0).max(5),
    defaultStopPct: z.number().positive().max(100).nullable(),
    defaultTargetPct: z.number().positive().max(1000).nullable(),
    setupTags: z.array(z.string().trim().min(1)).max(40),
    emotionTags: z.array(z.string().trim().min(1)).max(40),
    rules: z.object({
      enabled: z.record(z.string(), z.boolean()),
      capitalKrw: z.number().positive(),
      dailyTargetPct: z.number().positive().max(100),
      bigLossPct: z.number().positive().max(100),
      cutoffSummer: z.string().regex(/^\d{2}:\d{2}$/),
      cutoffWinter: z.string().regex(/^\d{2}:\d{2}$/),
      blackoutBeforeMin: z.number().int().min(0).max(120),
      blackoutAfterMin: z.number().int().min(0).max(120),
      stopGraceMin: z.number().min(0).max(60),
      withdrawTriggerPct: z.number().positive().max(1000),
      capitalStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    }),
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
