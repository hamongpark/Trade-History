# TRD — 기술 설계

## 1. 구성
| 영역 | 선택 | 이유 |
|---|---|---|
| 앱 | Next.js 16 (App Router) + React 19 + TypeScript | 서버 컴포넌트로 DB 직접 조회, API 라우트, Vercel 배포 용이 |
| 스타일 | Tailwind CSS 4 | 모바일 우선 빠른 UI |
| DB | Postgres (Supabase/Neon 무료) · 로컬은 PGlite | 1인 사용, 무료 티어 충분. 로컬은 설치 없이 실행 |
| ORM | Drizzle | 타입 안전, SQL 마이그레이션 파일 관리 |
| 차트 | TradingView lightweight-charts v5 | 모바일 터치 성능, 캔들·거래량·마커 지원 |
| AI | Anthropic SDK (Claude) | 캡처 인식(비전 + 구조화 출력), 주간 리포트 |
| 인증 | 단일 비밀번호 + JWT 쿠키 (jose) | 1인 전용, 90일 유지 |
| 배포 | Vercel (+ Cron) | 무료, PWA 호스팅, 주간 스케줄 |

## 2. 데이터 모델 (`src/lib/db/schema.ts`)
- `positions`: 티커, ET 거래일, 진입/청산 시각, 계획 손절·목표, 태그 배열, 확신도, 계획 준수, 사유, 메모, 분봉 상태, `excursion`(MAE/MFE 등 캐시 JSON)
- `executions`: position_id, side, executed_at(UTC), price, qty, fee
- `candles_1m`: (ticker, ts) PK, OHLCV, source — 공급자 무관 캐시
- `ai_reports`: 기간, 모델, 본문(md), focus, 통계 스냅샷, 토큰 사용량
- `settings`: key/value(JSON)

손익·보유시간·R 등 파생 지표는 저장하지 않고 체결에서 매번 계산 (`src/lib/domain/position.ts`) → 공식 변경 시 재계산 불필요.

## 3. 시간 처리
- 저장은 모두 UTC. 입력은 설정 시간대(기본 KST)로 해석해 변환
- 거래일은 **ET 날짜** (KST 밤 22:30 ~ 새벽 05:00 매매가 하루로 묶임)
- 캡처에 날짜가 없고 저녁→새벽으로 시각이 넘어가면 다음 날로 자동 처리

## 4. 분봉 데이터 (`src/lib/market-data/`)
- `MarketDataProvider` 인터페이스: `fetchMinuteBars(ticker, from, to)`
- 구현: **Alpaca**(무료 키, 과거 수년치, 추천) → **Polygon**(무료 키, 2년) → **Yahoo**(키 불필요, 최근 30일, 비공식)
- 설정된 공급자를 우선순위대로 시도, `MARKET_DATA_PROVIDER` 로 강제 지정
- 유료 공급자 추가: 인터페이스 구현 후 `PROVIDERS` 배열 앞에 등록하면 끝
- 저장 직후 가져와 `candles_1m` 에 upsert(최대 8초 대기, 실패해도 저장은 성공) → MAE/MFE 계산해 `positions.excursion` 에 캐시

## 5. AI
| 기능 | 모델(기본) | 방식 | 비용 추정 |
|---|---|---|---|
| 캡처 인식 | `claude-opus-5` | 이미지(긴 변 1568px로 축소) + 구조화 출력(zod 스키마) | 장당 약 1.5K 입력 토큰, 건당 수 센트 |
| 주간 리포트 | `claude-opus-5`, adaptive thinking, effort high | 통계·매매 요약 JSON → 구조화 출력 {focus, markdown} | 주 1회, 회당 약 $0.1~0.3 |

- **API 키가 없으면** Claude 앱(구독) 복사·붙여넣기 방식으로 동작: `GET /api/reports/prompt` 로 요청문 생성, `POST /api/reports/manual` 로 답변 저장, 캡처 답변은 클라이언트에서 `parsePastedExtraction` 으로 검증. 구독 로그인 토큰을 서버에서 쓰는 방식은 약관상 허용되지 않아 사용하지 않음
- 두 모델 모두 환경변수로 교체 가능 (`ANTHROPIC_EXTRACT_MODEL`, `ANTHROPIC_REPORT_MODEL`, `ANTHROPIC_REPORT_EFFORT`)
- 안전 분류기 오탐 대비 서버 측 `fallbacks: "default"` 활성화
- 비용 최적화: 주 1회 + 이미 있으면 생성 안 함, 원문 대신 압축된 통계/요약만 전송, 이미지 축소

## 6. API
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET/POST | `/api/positions` | 목록 / 생성 (+분봉) |
| POST | `/api/positions/batch` | 캡처 일괄 저장 |
| GET/PUT/DELETE | `/api/positions/:id` | 조회/수정/삭제 |
| POST | `/api/positions/:id/candles` | 분봉 재조회 |
| POST | `/api/import/screenshot` | multipart `images[]`, `date` → 추출 결과 |
| POST | `/api/reports` | `{weekStart, force?}` 주간 리포트 생성 (API) |
| GET | `/api/reports/prompt?weekStart=` | Claude 앱용 요청문 |
| POST | `/api/reports/manual` | `{weekStart, text}` 붙여넣은 리포트 저장 |
| GET | `/api/cron/weekly-report` | Vercel Cron (Bearer CRON_SECRET) |
| GET/PUT | `/api/settings` | 설정 |
| GET | `/api/export?type=positions\|executions\|json` | 내보내기 |
| POST | `/api/auth/login`, `/api/auth/logout` | 인증 |

## 7. 보안
- `src/proxy.ts` 에서 모든 페이지/API 에 세션 쿠키 검사 (로그인·크론·PWA 자산 제외)
- 비밀번호 상수 시간 비교, 실패 시 지연
- API 키는 서버 환경변수로만 사용, 클라이언트 노출 없음

## 8. 테스트
- `npm test`: 손익 계산(분할 체결), 포지션 그룹핑, 시간대 변환, MAE/MFE, 통계·진단 단위 테스트
