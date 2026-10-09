# HAMS Asset

HAMS 통합 로그인 사용자가 은행·증권 자산을 등록하고 현재 시세 기반 포트폴리오와 목표 달성 계획을 관리하는 자산 대시보드입니다.

## 주요 기능

- @hams-fam/sso-client 기반 HAMS 통합 로그인과 Zustand 사용자 상태
- 은행·증권 계좌 및 보유 종목 등록
- 금융기관, 종목명, 종목 코드의 한글 초성 검색
- 국내 주식 네이버 금융 시세와 해외 주식 Nasdaq 공개 시세 조회
- USD/KRW 환산, 포트폴리오 손익과 비중 계산
- 목표 금액과 월 투자 가능 금액 설정
- SSO 사용자 AI 설정을 이용한 맞춤 목표 추천
- 금일 AI 추천 재사용과 암호화 히스토리
- 매수·매도·입출금·배당·이자 거래 기록
- 공통 alert, confirm, snackbar와 반응형 UI

## 기술 구성

- Next.js 16 App Router
- React 19, TypeScript, Zustand
- Turso/libSQL
- AES-256-GCM envelope encryption
- HAMS SSO Client

개발 서버는 http://localhost:3013 에서 실행됩니다.

## 시작하기

~~~bash
pnpm install
pnpm dev
~~~

운영 빌드 검증:

~~~bash
pnpm lint
pnpm build
~~~

## 환경 변수

.env는 커밋하지 않습니다. env.example을 복사해 로컬 값을 설정합니다.

| 변수 | 용도 |
| --- | --- |
| NEXT_PUBLIC_APP_URL | 서비스 기준 URL |
| HAMS_OAUTH_SERVER_URL | HAMS OAuth 서버 URL |
| HAMS_OAUTH_CLIENT_ID | SSO 클라이언트 ID |
| HAMS_OAUTH_CLIENT_SECRET | SSO 클라이언트 비밀키 |
| HAMS_COOKIE_PREFIX | 서비스별 쿠키 접두어 |
| HAMS_SESSION_SECRET | SSO 세션 암호화·서명 키 |
| HAMS_ASSET_ENCRYPTION_KEY | 자산 데이터 암호화 마스터 키 |
| TURSO_DATABASE_URL | Turso 데이터베이스 URL |
| TURSO_AUTH_TOKEN | Turso 인증 토큰 |
| HAMS_SSO_SESSION_MAX_AGE_SEC | 선택적 세션 유지 시간 |
| NEXT_PUBLIC_DEV_MOCK_LOGIN | 로컬 mock 로그인 활성화 여부 |

운영 환경에서는 HAMS_ASSET_ENCRYPTION_KEY를 HAMS_SESSION_SECRET과 다른 충분히 긴 무작위 값으로 설정합니다.

## 화면

| 경로 | 설명 |
| --- | --- |
| / | 총 자산, 구성, 보유 자산, 시세 상태 |
| /portfolio | 자산별 매입금액·평가금액·수익률·비중 |
| /accounts | 등록한 은행·증권 계좌 |
| /transactions | 암호화된 수동 거래 원장 |
| /goals | 목표 달성률, 예상 기간, AI 맞춤 방향 |

모든 화면은 components/AppSidebar.tsx의 공통 데스크톱·모바일 내비게이션을 사용합니다.

## 서버 API

| API | 설명 |
| --- | --- |
| /api/assets | 암호화 자산 조회·등록 |
| /api/assets/[id] | 등록 자산 삭제 |
| /api/portfolio | 현재 시세 기반 포트폴리오 집계 |
| /api/stocks/search | 종목 검색과 50개 단위 페이지 처리 |
| /api/goal | 암호화 목표 조회·저장 |
| /api/goal/ai-recommendation | 금일 추천 조회 및 새 AI 추천 생성 |
| /api/transactions | 암호화 거래 조회·등록 |
| /api/auth/*, /api/sso/* | 로그인 세션과 SSO 처리 |

## 데이터와 보안

- 자산, 목표, AI 추천 히스토리, 거래 내역은 레코드별 비밀키로 AES-256-GCM 암호화합니다.
- 레코드 비밀키는 마스터 키로 다시 암호화해 저장합니다.
- 사용자 ID를 모든 조회 조건에 포함해 데이터를 분리합니다.
- AI API 키는 브라우저와 Zustand에 전달하지 않습니다.
- AI 호출은 SSO 서비스 토큰으로 OAuth 서버의 AI 모델·생성 API를 호출합니다.
- 계좌번호는 마지막 네 자리만 입력받아 마스킹하며 AI 분석에는 전달하지 않습니다.

Turso 테이블은 lib/turso.ts에서 필요 시 생성합니다.

## 시세 정책

- 국내 주식: 네이버 금융 공개 시세
- 해외 주식: Nasdaq 공개 시세
- 환율: Frankfurter USD/KRW
- 자동 갱신: 60초
- 수동 갱신: 서버 시세 캐시 우회
- 시세 실패: 등록 평균 매입가를 사용하고 등록가로 표시

현재 시세는 공식 증권사 체결 WebSocket이 아니므로 제공처 상태와 장 운영 시간에 따라 지연될 수 있습니다.

## 주요 코드

- app/page.tsx: 메인 대시보드
- components/AppSidebar.tsx: 공통 내비게이션과 설정 진입
- components/AssetSettingsDrawer.tsx: 자산·목표 설정
- components/FeedbackProvider.tsx: 공통 피드백 UI
- lib/asset-crypto.ts: envelope encryption
- lib/asset-spec.ts: 자산 데이터 규격
- lib/market-prices.ts: 시세·환율 조회
- lib/turso.ts: 데이터베이스 연결과 스키마

## 프로젝트 문서

- README.md: 프로젝트 설명과 실행 방법
- AGENTS.md: AI 에이전트와 개발 작업 규칙
- CLAUDE.md: Claude 작업 체크리스트
- HISTORY.md: 날짜별 주요 변경 이력
