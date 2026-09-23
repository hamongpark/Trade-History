import { NextResponse } from "next/server";
import { AiError, aiEnabled } from "@/lib/ai/client";
import { extractFillsFromImages, type ImageInput } from "@/lib/ai/extract";
import { jsonError } from "@/lib/api";

export const maxDuration = 120;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export async function POST(req: Request) {
  try {
    if (!aiEnabled()) throw new AiError("ANTHROPIC_API_KEY 가 설정되지 않았습니다");
    const form = await req.formData();
    const hintDate = String(form.get("date") ?? "");
    const files = form.getAll("images").filter((f): f is File => f instanceof File);
    if (files.length === 0 || files.length > 5) throw new AiError("이미지는 1~5장 올려주세요");
    const images: ImageInput[] = [];
    for (const f of files) {
      const type = TYPES.find((t) => t === f.type);
      if (!type) throw new AiError(`지원하지 않는 이미지 형식: ${f.type}`);
      images.push({ mediaType: type, base64: Buffer.from(await f.arrayBuffer()).toString("base64") });
    }
    return NextResponse.json(await extractFillsFromImages(images, hintDate));
  } catch (e) {
    return jsonError(e);
  }
}
