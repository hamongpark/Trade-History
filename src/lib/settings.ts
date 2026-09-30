import "server-only";
import { getDb, schema } from "./db";
import { KST } from "./domain/time";

export interface AppSettings {
  /** 체결 시각 입력 기준 타임존 (토스증권 체결내역은 한국시간) */
  inputTimezone: string;
  /** 화면 표시 타임존 */
  displayTimezone: string;
  /** 체결 금액 대비 수수료율 (%). 체결별 수수료를 직접 입력하지 않았을 때 자동 적용 */
  feeRatePct: number;
  /** 일 손실 한도 (원, 양수로 입력) */
  dailyLossLimitKrw: number;
  /** 새 기록의 기본 손절율 (%) */
  defaultStopPct: number | null;
  /** 새 기록의 기본 목표율 (%) */
  defaultTargetPct: number | null;
  /** 하루 최대 매매 횟수 (포지션 기준) */
  maxTradesPerDay: number;
  setupTags: string[];
  emotionTags: string[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  inputTimezone: KST,
  displayTimezone: KST,
  feeRatePct: 0.1,
  dailyLossLimitKrw: 300000,
  maxTradesPerDay: 5,
  defaultStopPct: 10,
  defaultTargetPct: 3,
  setupTags: ["돌파", "눌림목", "갭상승", "VWAP 반등", "고점 돌파 실패 숏커버", "뉴스/공시", "거래량 급증"],
  emotionTags: ["확신", "FOMO", "복수매매", "조급함", "지루함", "두려움", "욕심"],
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.select().from(schema.settings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...stored } as AppSettings;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const db = await getDb();
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;
    await db
      .insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  }
  return getSettings();
}
