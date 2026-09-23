import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "th_session";
const MAX_AGE_DAYS = 90;

/** APP_PASSWORD 가 없으면 (로컬 개발) 인증을 생략한다 */
export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

function secret() {
  const s = process.env.AUTH_SECRET ?? process.env.APP_PASSWORD;
  if (!s) throw new Error("AUTH_SECRET 미설정");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(): Promise<{ token: string; maxAge: number }> {
  const maxAge = MAX_AGE_DAYS * 24 * 3600;
  const token = await new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_DAYS}d`)
    .sign(secret());
  return { token, maxAge };
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

/** 타이밍 공격을 피하기 위한 상수 시간 비교 */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
