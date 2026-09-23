import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, verifySessionToken } from "./lib/auth";

const PUBLIC = ["/login", "/api/auth/login", "/api/cron/", "/manifest.webmanifest", "/sw.js", "/icons/", "/apple-icon"];

export async function proxy(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
