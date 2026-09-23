import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken, safeEqual } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected || !password || !safeEqual(password, expected)) {
    await new Promise((r) => setTimeout(r, 800)); // 무차별 대입 완화
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다" }, { status: 401 });
  }
  const { token, maxAge } = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge, path: "/" });
  return res;
}
