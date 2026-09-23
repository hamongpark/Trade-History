import { alpacaProvider } from "./alpaca";
import { mockProvider } from "./mock";
import { polygonProvider } from "./polygon";
import type { MarketDataProvider } from "./types";
import { yahooProvider } from "./yahoo";

/** 우선순위 순서. 유료 공급자를 추가하면 여기 앞쪽에 넣는다. */
export const PROVIDERS: MarketDataProvider[] = [alpacaProvider, polygonProvider, yahooProvider];

/**
 * 사용할 공급자 목록 (앞에서부터 시도).
 * MARKET_DATA_PROVIDER 로 강제 지정 가능, 없으면 설정된 공급자 전부를 우선순위대로 사용.
 */
export function activeProviders(): MarketDataProvider[] {
  const forced = process.env.MARKET_DATA_PROVIDER;
  if (forced) {
    const p = [...PROVIDERS, mockProvider].find((x) => x.id === forced);
    if (!p) throw new Error(`알 수 없는 MARKET_DATA_PROVIDER: ${forced}`);
    return [p];
  }
  return PROVIDERS.filter((p) => p.isConfigured());
}

export { MarketDataError, type MarketDataProvider } from "./types";
