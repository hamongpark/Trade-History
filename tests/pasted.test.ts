import { describe, expect, it } from "vitest";
import { parsePastedExtraction, splitPastedReport } from "@/lib/domain/pasted";

describe("parsePastedExtraction", () => {
  it("코드 블록과 설명이 섞인 Claude 답변에서 JSON 추출", () => {
    const text = `네, 추출했습니다.
\`\`\`json
{"fills":[{"ticker":"nvda","side":"매수","date":null,"time":"22:35:10","price":"180.5","qty":20,"fee":null},
{"ticker":"NVDA","side":"sell","date":"2026-09-22","time":"22:41","price":181.9,"qty":20}],"warnings":["가격 흐림"]}
\`\`\``;
    const r = parsePastedExtraction(text);
    expect(r.fills).toHaveLength(2);
    expect(r.fills[0]).toMatchObject({ ticker: "NVDA", side: "buy", time: "22:35", price: 180.5, fee: null });
    expect(r.fills[1]).toMatchObject({ side: "sell", date: "2026-09-22", fee: null });
    expect(r.warnings).toEqual(["가격 흐림"]);
  });

  it("잘못된 입력은 한국어 오류", () => {
    expect(() => parsePastedExtraction("표로 정리했어요")).toThrow("JSON");
    expect(() => parsePastedExtraction('{"fills":[{"ticker":"A","side":"buy","time":"9시","price":1,"qty":1}]}')).toThrow("읽을 수 없는");
  });
});

describe("splitPastedReport", () => {
  it("집중할 한 가지 줄 분리", () => {
    const r = splitPastedReport("**집중할 한 가지:** 손실 직후 15분은 쉰다\n\n## 한 줄 요약\n좋았음");
    expect(r.focus).toBe("손실 직후 15분은 쉰다");
    expect(r.markdown).toBe("## 한 줄 요약\n좋았음");
  });
  it("없으면 전체를 본문으로", () => {
    expect(splitPastedReport("## 요약\n내용")).toEqual({ focus: "", markdown: "## 요약\n내용" });
  });
});
