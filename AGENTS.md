# HAMS Asset 작업 지침

이 파일은 이 저장소를 수정하는 AI 에이전트와 개발자가 따라야 할 프로젝트 규칙입니다.

## 작업 전 확인

1. README.md에서 현재 기능, API, 데이터 저장 방식을 확인합니다.
2. HISTORY.md에서 최근 결정과 변경 사항을 확인합니다.
3. Next.js 동작을 변경할 때는 설치된 node_modules/next/dist/docs 문서를 먼저 확인합니다.
4. 기존 변경 사항을 덮어쓰거나 되돌리지 말고 관련 파일의 현재 상태를 확인합니다.

## 핵심 기술과 실행

- Next.js 16 App Router, React 19, TypeScript를 사용합니다.
- 패키지 관리자는 pnpm이며 개발 포트는 3013입니다.
- 로그인은 반드시 @hams-fam/sso-client를 사용합니다.
- 클라이언트 로그인 상태는 store/auth-store.ts의 Zustand store를 사용합니다.
- 데이터베이스는 Turso/libSQL이며 스키마는 lib/turso.ts에서 관리합니다.

## 인증과 보안

- 사용자 데이터 API는 getSsoUserFromRequest()로 인증하고 user.id를 조회 조건에 포함합니다.
- API 키, SSO 토큰, Turso 토큰, 암호화 키를 클라이언트 응답·Zustand·로그에 노출하지 않습니다.
- 사용자 AI API 키는 직접 전달받지 않습니다. 서비스 토큰으로 HAMS OAuth AI API를 호출합니다.
- 자산, 목표, AI 히스토리, 거래 데이터는 encryptAssetJson()과 decryptAssetJson()을 사용합니다.
- 계좌번호 원문을 저장하지 않고 마지막 네 자리 기반 마스킹 값만 저장합니다.
- 오류 응답에는 내부 토큰이나 복호화 상세를 포함하지 않습니다.

## 데이터 규칙

- 자산 규격은 lib/asset-spec.ts를 단일 기준으로 사용합니다.
- 금액과 수량은 계산 전에 유한한 숫자인지 검증합니다.
- 새 암호화 데이터 유형은 encrypted_payload와 wrapped_secret 구조를 유지합니다.
- 새 테이블에는 사용자 ID와 정렬 날짜 인덱스를 함께 고려합니다.
- AI 추천 히스토리 날짜 비교는 Asia/Seoul을 기준으로 합니다.
- 거래 샘플을 실제 데이터처럼 표시하지 않습니다. 저장된 거래가 없으면 빈 상태를 표시합니다.

## AI 추천

- Planning Board와 동일하게 SSO AI 모델 API에서 기본 모델을 확인한 후 생성 API를 호출합니다.
- AI 프롬프트에는 계좌번호와 개인정보를 포함하지 않습니다.
- 추천은 수익 보장이나 직접적인 종목 매수·매도 지시로 표현하지 않습니다.
- 금일 생성된 최신 추천이 있으면 재사용하고, 다시 분석을 선택한 경우에만 추가 생성합니다.

## UI와 반응형

- 사이드바와 모바일 메뉴는 components/AppSidebar.tsx만 수정합니다.
- alert, confirm, snackbar는 FeedbackProvider를 사용합니다.
- 설정 화면은 AssetSettingsDrawer에서 관리합니다.
- 900px 이하에서는 모바일 내비게이션을 사용합니다.
- 폼은 데스크톱·태블릿·모바일에서 충분한 폭을 확보하고 min-width: 0과 max-width: 100%를 고려합니다.
- 모바일에서 버튼을 숨길 때 실제로 동작하는 대체 진입 경로가 있는지 확인합니다.
- 새 페이지 스타일은 페이지 전용 클래스 범위를 사용해 전역 충돌을 피합니다.

## 시세

- 자동 조회는 서버 캐시를 사용할 수 있지만 수동 새로고침은 refresh=1로 캐시를 우회합니다.
- 공개 시세를 공식 증권사 체결 스트리밍으로 표현하지 않습니다.
- 시세 조회 실패 시 평균 매입가 fallback과 데이터 출처 상태를 유지합니다.

## 검증

일반 변경은 최소한 다음 명령으로 검증합니다.

~~~bash
pnpm lint
pnpm build
~~~

- UI 변경은 데스크톱, 900px 이하 태블릿, 520px 이하 모바일 배치를 확인합니다.
- API 변경은 미인증 401, 잘못된 입력 400, 사용자별 데이터 격리를 확인합니다.
- 문서와 환경 변수 예시는 실제 비밀값을 포함하지 않아야 합니다.

## 문서 관리

- 기능, 환경 변수, API, 데이터 모델이 바뀌면 README.md를 갱신합니다.
- 사용자 동작이나 구조에 영향을 주는 변경은 작업 날짜 아래 HISTORY.md에 추가합니다.
- 에이전트 규칙이 바뀌면 AGENTS.md와 CLAUDE.md를 함께 검토합니다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in node_modules/next/dist/docs/ before writing any code. Heed deprecation notices.

This block is written and re-added by next dev. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
