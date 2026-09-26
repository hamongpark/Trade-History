# 매매일지 (Trade History)

미국 주식 스캘핑 매매를 모바일에서 기록하고, 1분봉 차트와 통계·AI 주간 리포트로 내 매매 스타일을 분석하는 개인용 PWA.

- 기획: [docs/01-prd.md](docs/01-prd.md) · 기술: [docs/02-trd.md](docs/02-trd.md) · 화면: [docs/03-ui.md](docs/03-ui.md)

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 필요한 값만 채우기 (전부 비워도 실행됨)
npm run dev                  # http://localhost:3000
```

- `DATABASE_URL` 이 없으면 `.data/pglite` 에 로컬 DB 가 자동 생성됩니다.
- 시세 API 키가 없어도 `MARKET_DATA_PROVIDER=mock` 으로 가짜 분봉을 확인할 수 있습니다.

```bash
npm test          # 단위 테스트
npm run lint
npm run typecheck
```

## 배포 (Vercel + Supabase, 모두 무료 티어)

1. **Supabase** 프로젝트 생성 → Project Settings → Database → Connection string → **Transaction pooler** URL 복사
2. **Alpaca** 무료 계정 가입 → Paper Trading API Key 발급 (시세 조회용, 과거 1분봉 수년치)
3. (선택) **Anthropic** API 키 — 없으면 Claude 앱(구독)에 복사·붙여넣기로 캡처 인식·주간 리포트를 사용합니다
4. **Vercel** 에 이 저장소 Import → Environment Variables 설정:
   - `DATABASE_URL`, `APP_PASSWORD`, `AUTH_SECRET`(32자 이상 무작위)
   - `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY`
   - (선택) `ANTHROPIC_API_KEY`, `CRON_SECRET`
5. 배포 후 휴대폰에서 접속 → 공유 → **홈 화면에 추가**

DB 테이블은 첫 요청 시 `drizzle/` 마이그레이션으로 자동 생성됩니다. 주간 리포트는 `vercel.json` 의 Cron 으로 매주 토요일 01:00 UTC(10:00 KST)에 생성됩니다.

## 스키마 변경

`src/lib/db/schema.ts` 수정 → `npm run db:generate` → 생성된 `drizzle/*.sql` 커밋.

## 분봉 공급자 추가 (유료 전환)

`src/lib/market-data/` 에 `MarketDataProvider` 를 구현하고 `index.ts` 의 `PROVIDERS` 앞쪽에 등록하면 됩니다.
