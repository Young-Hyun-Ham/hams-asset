# Claude 작업 안내

HAMS Asset를 수정하기 전에 다음 순서로 문서를 읽습니다.

1. AGENTS.md
2. README.md
3. HISTORY.md

## 필수 규칙

- 서비스는 Next.js 16, React 19, TypeScript 기반이며 개발 포트는 3013입니다.
- Next.js 관련 변경 전 node_modules/next/dist/docs의 현재 버전 문서를 확인합니다.
- HAMS SSO와 Zustand 사용자 상태 구조를 우회하지 않습니다.
- 사용자별 Route Handler는 서버에서 인증하고 user.id로 데이터를 격리합니다.
- 자산, 목표, AI 히스토리, 거래 기록의 암호화를 해제하거나 평문 저장으로 변경하지 않습니다.
- AI API 키와 서비스 액세스 토큰을 클라이언트 상태나 로그에 노출하지 않습니다.
- AI 호출은 Planning Board와 동일한 SSO 모델 조회 및 생성 흐름을 유지합니다.
- 공통 사이드바, 모바일 메뉴, 설정 드로어, 피드백 Provider를 중복 구현하지 않습니다.
- 모바일 UI는 900px과 520px 기준을 함께 확인합니다.
- 기존 사용자 변경과 비밀 환경 변수를 보존합니다.

## 작업 체크리스트

- 변경 전에 관련 API, 컴포넌트, 스타일, 데이터 규격을 함께 확인합니다.
- 데이터 스키마 변경은 lib/turso.ts와 README.md에 반영합니다.
- 사용자에게 보이는 동작 변경은 HISTORY.md에 날짜별로 기록합니다.
- 오류 문구는 사용자가 이해할 수 있는 한국어로 제공합니다.
- 실제 데이터가 없는 영역에 샘플 자산이나 샘플 거래를 표시하지 않습니다.
- 완료 전 pnpm lint와 pnpm build를 실행합니다.

세부 보안, 데이터, UI 규칙은 AGENTS.md를 기준으로 합니다.
