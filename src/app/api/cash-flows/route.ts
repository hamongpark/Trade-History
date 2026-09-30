import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { addCashFlow, cashFlowInputSchema, listCashFlows } from "@/lib/repo/cashflows";

export async function GET() {
  return NextResponse.json(await listCashFlows());
}

export async function POST(req: Request) {
  try {
    return NextResponse.json({ id: await addCashFlow(cashFlowInputSchema.parse(await req.json())) });
  } catch (e) {
    return jsonError(e);
  }
}
