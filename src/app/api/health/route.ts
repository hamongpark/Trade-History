import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { addDays, etDate } from "@/lib/domain/time";
import { getUsdKrw } from "@/lib/fx";
import { activeProviders } from "@/lib/market-data";

export const dynamic = "force-dynamic";

/** 연결 문자열의 비밀번호를 가린다 */
function redact(text: string): string {
  return text.replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, "$1****@");
}

function describeDbUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return { set: false };
  try {
    const u = new URL(raw);
    return {
      set: true,
      protocol: u.protocol,
      user: decodeURIComponent(u.username),
      passwordLength: decodeURIComponent(u.password).length,
      host: u.hostname,
      port: u.port,
      database: u.pathname.slice(1),
      hasWhitespace: /\s/.test(raw),
      hasPlaceholder: raw.includes("[YOUR-PASSWORD]") || raw.includes("YOUR-PASSWORD"),
    };
  } catch {
    return { set: true, parseError: "URL 형식이 아닙니다 (postgresql://… 로 시작해야 함, 비밀번호의 특수문자는 인코딩 필요)" };
  }
}

/** 배포 설정 진단 (로그인 필요). 비밀 값은 노출하지 않는다 */
export async function GET() {
  const env = {
    DATABASE_URL: describeDbUrl(),
    APP_PASSWORD: Boolean(process.env.APP_PASSWORD),
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
    ALPACA_API_KEY_ID: Boolean(process.env.ALPACA_API_KEY_ID),
    ALPACA_API_SECRET_KEY: Boolean(process.env.ALPACA_API_SECRET_KEY),
    ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
    region: process.env.VERCEL_REGION ?? null,
  };
  let marketData: string;
  try {
    marketData = activeProviders().map((p) => p.id).join(" → ") || "없음";
  } catch (e) {
    marketData = e instanceof Error ? e.message : String(e);
  }
  try {
    const db = await getDb();
    const r = await db.execute(sql`select count(*)::int as n from positions`);
    const rows = (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows) as { n: number }[];
    const t0 = Date.now();
    const q = await getUsdKrw(addDays(etDate(new Date()), -1));
    const fx = `${q.source} ${q.rate} (${q.rateDate}, ${Date.now() - t0}ms)`;
    return NextResponse.json({ ok: true, db: `연결 성공 (포지션 ${rows[0]?.n ?? 0}건)`, fx, marketData, env });
  } catch (e) {
    const err = e as Error & { cause?: Error & { code?: string } };
    return NextResponse.json(
      {
        ok: false,
        db: "연결 실패",
        error: redact(err.message ?? String(e)),
        cause: err.cause ? redact(`${err.cause.code ?? ""} ${err.cause.message}`.trim()) : null,
        marketData,
        env,
      },
      { status: 500 },
    );
  }
}
