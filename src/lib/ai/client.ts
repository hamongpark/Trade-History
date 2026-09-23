import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AnthropicBeta } from "@anthropic-ai/sdk/resources/beta/beta";

/** 모델은 환경변수로 교체 가능. 비용을 더 줄이려면 claude-sonnet-5 / claude-haiku-4-5 등으로 변경 */
export const EXTRACT_MODEL = process.env.ANTHROPIC_EXTRACT_MODEL ?? "claude-opus-5";
export const REPORT_MODEL = process.env.ANTHROPIC_REPORT_MODEL ?? "claude-opus-5";
export const REPORT_EFFORT = (process.env.ANTHROPIC_REPORT_EFFORT ?? "high") as "low" | "medium" | "high";

/** 안전 분류기가 요청을 거절하면 서버 측에서 권장 모델로 자동 재시도 */
export const FALLBACK: { betas: AnthropicBeta[]; fallbacks: "default" } = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | undefined;
export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export class AiError extends Error {}
