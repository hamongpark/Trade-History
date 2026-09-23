import type { Bar } from "../domain/types";

/**
 * 분봉 데이터 공급자 인터페이스.
 * 유료 API 를 추가하려면 이 인터페이스를 구현하고 index.ts 의 PROVIDERS 에 등록하면 된다.
 */
export interface MarketDataProvider {
  readonly id: string;
  readonly label: string;
  /** 환경변수 등 필요한 설정이 갖춰졌는지 */
  isConfigured(): boolean;
  /** [from, to] 구간의 1분봉 (프리/애프터마켓 포함). ts 는 분봉 시작 시각 */
  fetchMinuteBars(ticker: string, from: Date, to: Date, hint?: FetchHint): Promise<Bar[]>;
}

/** 실제 공급자는 무시한다. 데모용 mock 공급자가 체결가 근처로 분봉을 만들 때 사용 */
export interface FetchHint {
  fills: { t: Date; price: number }[];
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
