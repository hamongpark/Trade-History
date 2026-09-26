import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Extraction } from "../domain/pasted";
import { AiError, EXTRACT_MODEL, FALLBACK, anthropic } from "./client";

export const EXTRACT_SYSTEM = `당신은 증권사 앱(주로 토스증권) 체결내역 스크린샷에서 미국 주식 체결 기록을 추출합니다.
- 실제로 체결된 건만 추출합니다. 미체결·취소·주문 접수 건은 제외합니다.
- 가격은 반드시 USD 1주당 체결가를 사용합니다. 원화 금액이나 총 체결금액을 가격으로 쓰지 않습니다.
- 한 주문이 여러 번 나눠 체결됐다면 화면에 나뉘어 보이는 대로 각각 추출합니다.
- 시각은 화면에 보이는 값을 그대로 사용합니다 (시간대 변환 금지).
- 스크린샷이 여러 장이고 같은 체결이 중복으로 보이면 한 번만 포함합니다.
- 확실하지 않은 값은 가장 그럴듯한 값을 넣고 warnings 에 적습니다.`;

export type { Extraction };

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64: string;
}

export async function extractFillsFromImages(images: ImageInput[], hintDate: string): Promise<Extraction> {
  const res = await anthropic().beta.messages.parse({
    model: EXTRACT_MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    system: EXTRACT_SYSTEM,
    output_config: { format: betaZodOutputFormat(Extraction) },
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
          })),
          {
            type: "text",
            text: `위 스크린샷의 체결 내역을 추출해 주세요. 화면에 날짜가 없으면 date 는 null 로 두세요 (참고: 사용자가 선택한 날짜는 ${hintDate}).`,
          },
        ],
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new AiError("AI 가 이미지 처리를 거절했습니다");
  if (res.stop_reason === "max_tokens") throw new AiError("응답이 너무 길어 잘렸습니다. 이미지를 나눠서 올려주세요");
  if (!res.parsed_output) throw new AiError("체결 내역을 읽지 못했습니다");
  return res.parsed_output;
}
