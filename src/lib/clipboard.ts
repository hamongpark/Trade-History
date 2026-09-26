/** 클립보드 복사. 권한이 없으면 false (호출 측에서 직접 선택·복사할 수 있게 텍스트를 보여줌) */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const CLAUDE_APP_URL = "https://claude.ai/new";
