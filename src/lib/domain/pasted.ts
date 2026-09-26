import { z } from "zod";

/** 캡처에서 추출한 체결 (API 구조화 출력과 Claude 앱 붙여넣기 공용 스키마) */
export const ExtractedFill = z.object({
  ticker: z.string().describe("미국 주식 티커 (대문자). 화면에 종목명만 있으면 해당 종목의 티커"),
  side: z.enum(["buy", "sell"]),
  date: z.string().nullable().describe("체결 날짜 YYYY-MM-DD, 화면에 없으면 null"),
  time: z.string().describe("체결 시각 HH:mm (24시간제, 화면에 표시된 그대로)"),
  price: z.number().describe("1주당 체결가 (USD)"),
  qty: z.number().describe("체결 수량 (주)"),
  fee: z.number().nullable().describe("수수료 (USD), 화면에 없으면 null"),
});

export const Extraction = z.object({
  fills: z.array(ExtractedFill),
  warnings: z.array(z.string()).describe("읽기 애매했던 부분 (한국어)"),
});
export type Extraction = z.infer<typeof Extraction>;

/** Claude 앱(구독)에 캡처와 함께 붙여넣을 요청문 */
export const CAPTURE_PROMPT = `첨부한 증권사 앱(토스증권) 체결내역 스크린샷에서 미국 주식 체결 기록을 추출해 주세요.

규칙:
- 실제로 체결된 건만 추출합니다. 미체결·취소·주문 접수 건은 제외합니다.
- price 는 USD 1주당 체결가입니다. 원화 금액이나 총 체결금액을 쓰지 않습니다.
- 한 주문이 여러 번 나눠 체결됐다면 화면에 보이는 대로 각각 적습니다.
- time 은 화면에 보이는 시각 그대로 HH:mm (24시간제, 시간대 변환 금지).
- date 는 화면에 날짜가 있으면 YYYY-MM-DD, 없으면 null.
- 수수료가 보이지 않으면 fee 는 null.
- 여러 장에 같은 체결이 중복으로 보이면 한 번만 포함합니다.
- 애매한 값은 가장 그럴듯한 값을 넣고 warnings 에 한국어로 적습니다.

설명 없이 아래 형식의 JSON 만 출력하세요.
{"fills":[{"ticker":"NVDA","side":"buy","date":null,"time":"22:35","price":180.5,"qty":20,"fee":null}],"warnings":[]}`;

/** Claude 답변에서 JSON 을 찾아 검증한다. 코드 블록이나 앞뒤 설명이 섞여 있어도 된다 */
export function parsePastedExtraction(text: string): Extraction {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("답변에서 JSON 을 찾지 못했습니다");
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("JSON 형식이 올바르지 않습니다. Claude 답변 전체를 그대로 붙여넣어 주세요");
  }
  const obj = (raw ?? {}) as Record<string, unknown>;
  const fills = (Array.isArray(obj.fills) ? obj.fills : []).map((f: Record<string, unknown>) => ({
    ...f,
    ticker: String(f.ticker ?? "").trim().toUpperCase(),
    side: String(f.side ?? "").toLowerCase() === "sell" || f.side === "매도" ? "sell" : "buy",
    date: f.date ? String(f.date) : null,
    time: String(f.time ?? "").slice(0, 5),
    price: Number(f.price),
    qty: Number(f.qty),
    fee: f.fee == null || f.fee === "" ? null : Number(f.fee),
  }));
  const parsed = Extraction.safeParse({ fills, warnings: Array.isArray(obj.warnings) ? obj.warnings.map(String) : [] });
  if (!parsed.success) throw new Error("체결 항목 형식이 올바르지 않습니다");
  const bad = parsed.data.fills.filter((f) => !f.ticker || !/^\d{2}:\d{2}$/.test(f.time) || !(f.price > 0) || !(f.qty > 0));
  if (bad.length) throw new Error(`읽을 수 없는 체결 ${bad.length}건이 있습니다 (티커·시각·가격·수량 확인)`);
  return parsed.data;
}

/** 붙여넣은 답변에서 "집중할 한 가지" 줄과 본문을 분리 */
export function splitPastedReport(text: string): { focus: string; markdown: string } {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");
  const idx = lines.findIndex((l) => /집중할\s*한\s*가지\s*[:：]/.test(l));
  if (idx >= 0) {
    const focus = lines[idx].replace(/^.*?집중할\s*한\s*가지\s*[:：]\s*/, "").replace(/\*+/g, "").trim();
    const markdown = [...lines.slice(0, idx), ...lines.slice(idx + 1)].join("\n").trim();
    if (focus) return { focus, markdown };
  }
  return { focus: "", markdown: text.trim() };
}

