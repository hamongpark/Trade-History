import "server-only";
import fs from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

type Holder = { db: DB; ready: Promise<void> };
const g = globalThis as unknown as { __tradeDb?: Holder };

async function create(): Promise<Holder> {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Supabase/Neon 등의 트랜잭션 풀러와 호환되도록 prepared statement 를 끈다.
    const client = postgres(url, { prepare: false, max: 3 });
    const db = drizzlePg(client, { schema }) as unknown as DB;
    return { db, ready: migratePg(drizzlePg(client), { migrationsFolder: MIGRATIONS }) };
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다 (Vercel → Settings → Environment Variables)");
  // DATABASE_URL 이 없으면 로컬 개발용 임베디드 Postgres(PGlite)를 사용한다.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzleLite } = await import("drizzle-orm/pglite");
  const { migrate: migrateLite } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzleLite(client, { schema }) as unknown as DB;
  return { db, ready: migrateLite(drizzleLite(client), { migrationsFolder: MIGRATIONS }) };
}

let pending: Promise<Holder> | undefined;

export async function getDb(): Promise<DB> {
  try {
    if (!g.__tradeDb) {
      pending ??= create();
      g.__tradeDb = await pending;
    }
    await g.__tradeDb.ready;
    return g.__tradeDb.db;
  } catch (e) {
    // 초기화 실패를 캐시하지 않고 다음 요청에서 재시도
    g.__tradeDb = undefined;
    pending = undefined;
    throw e;
  }
}

export { schema };
