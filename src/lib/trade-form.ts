import type { Side } from "./domain/types";

export interface FillRow {
  key: string;
  side: Side;
  date: string;
  time: string;
  price: string;
  qty: string;
  fee: string; // 빈 값이면 서버에서 수수료율로 계산
}

export interface FormValues {
  ticker: string;
  fills: FillRow[];
  /** 손절율 % (평균 매수가 대비 하락폭) */
  stopPct: string;
  /** 목표율 % (평균 매수가 대비 상승폭) */
  targetPct: string;
  /** 적용 환율. 비워두면 거래일 기준환율 자동 적용 */
  fxRate: string;
  setupTags: string[];
  emotionTags: string[];
  confidence: number | null;
  followedPlan: boolean | null;
  entryReason: string;
  exitReason: string;
  note: string;
}

let seq = 0;
export const newKey = () => `r${Date.now()}-${seq++}`;

export function emptyFill(side: Side, date: string): FillRow {
  return { key: newKey(), side, date, time: "", price: "", qty: "", fee: "" };
}

export function emptyValues(date: string): FormValues {
  return {
    ticker: "",
    fills: [emptyFill("buy", date), emptyFill("sell", date)],
    stopPct: "",
    targetPct: "",
    fxRate: "",
    setupTags: [],
    emotionTags: [],
    confidence: null,
    followedPlan: null,
    entryReason: "",
    exitReason: "",
    note: "",
  };
}

