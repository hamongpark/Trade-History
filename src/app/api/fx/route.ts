import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getUsdKrw } from "@/lib/fx";

/** 기록 화면에서 거래일 환율 미리 채우기용 */
export async function GET(req: Request) {
  try {
    const date = new URL(req.url).searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date 형식 오류");
    return NextResponse.json(await getUsdKrw(date));
  } catch (e) {
    return jsonError(e);
  }
}
