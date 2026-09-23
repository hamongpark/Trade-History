import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AiError } from "./ai/client";

export function jsonError(e: unknown) {
  if (e instanceof ZodError) return NextResponse.json({ error: "입력값 오류", issues: e.issues }, { status: 400 });
  if (e instanceof AiError) return NextResponse.json({ error: e.message }, { status: 422 });
  console.error(e);
  return NextResponse.json({ error: e instanceof Error ? e.message : "서버 오류" }, { status: 500 });
}

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new Error("잘못된 id");
  return id;
}
