export type Side = "buy" | "sell";

export interface Execution {
  id?: number;
  side: Side;
  executedAt: Date;
  price: number;
  qty: number;
  fee: number;
}

export interface Bar {
  /** 분봉 시작 시각 (UTC) */
  ts: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** 분봉 기반 지표. 모든 % 는 소수(0.012 = 1.2%). */
export interface Excursion {
  /** 보유 중 최저가 기준 역행폭 (평균 매수가 대비, 음수 또는 0) */
  maePct: number;
  /** 보유 중 최고가 기준 순행폭 (평균 매수가 대비, 양수 또는 0) */
  mfePct: number;
  maeUsd: number;
  mfeUsd: number;
  /** 매도 후 30분 내 최고가가 평균 매도가보다 얼마나 높았나 (놓친 상승폭) */
  postExitHighPct: number | null;
  /** 매도 후 30분 내 최저가 (평균 매도가 대비) */
  postExitLowPct: number | null;
  /** 첫 매수 직전 10분 가격 변화율 (추격매수 여부 판단) */
  preEntryChangePct: number | null;
  /** 실현 수익 / 최대 가능 수익(MFE). 1 에 가까울수록 고점 근처 매도 */
  captureRatio: number | null;
  barsInHold: number;
  /**
   * 보유 중 가격이 계획 손절선에 처음 닿은 뒤 청산까지 걸린 분.
   * null = 손절선에 닿지 않음, undefined = 계산 전(이전 버전 데이터)
   */
  stopHitDelayMin?: number | null;
}

export interface PositionMetrics {
  status: "open" | "closed";
  buyQty: number;
  sellQty: number;
  openQty: number;
  maxQty: number;
  avgEntry: number;
  avgExit: number | null;
  grossPnl: number;
  fees: number;
  netPnl: number;
  /** 순손익 / (평균 매수가 × 최대 보유수량) */
  returnPct: number;
  /** 계획 손절율이 있을 때: 순손익 / 계획 위험금액 */
  rMultiple: number | null;
  openedAt: Date;
  closedAt: Date | null;
  holdSeconds: number | null;
  fillCount: number;
}

export interface PositionRecord {
  id: number;
  ticker: string;
  tradeDate: string;
  openedAt: Date;
  closedAt: Date | null;
  /** 계획 손절율 (%) */
  stopPct: number | null;
  /** 계획 목표율 (%) */
  targetPct: number | null;
  /** 적용 환율 (원/달러) */
  fxRate: number;
  /** 환율이 확정값이 아니라 임시값인지 */
  fxProvisional: boolean;
  /** 손절선 도달·손실 시 자가 체크: 다시 봐도 진입할 자리였나 */
  wouldReenter: boolean | null;
  setupTags: string[];
  emotionTags: string[];
  confidence: number | null;
  followedPlan: boolean | null;
  entryReason: string;
  exitReason: string;
  note: string;
  candlesStatus: string;
  candlesError: string | null;
  excursion: Excursion | null;
  executions: Execution[];
}

export interface PositionView extends PositionRecord {
  metrics: PositionMetrics;
  /** 원화 환산 금액 (metrics 의 USD 금액 × fxRate) */
  krw: { net: number; gross: number; fees: number };
  /** 손절율·목표율로 계산한 가격 (평균 매수가 기준) */
  stopPrice: number | null;
  targetPrice: number | null;
}
