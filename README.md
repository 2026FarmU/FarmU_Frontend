# FarmU Client

조합원 운영성과 통합 분석 · 출하 의사결정 · 작목 적합도 AI 플랫폼 **팜유**의 프론트엔드입니다.

---

## 기술 스택

| 분류 | 라이브러리 |
|---|---|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript 5 |
| 스타일 | Tailwind CSS v4 |
| UI 컴포넌트 | shadcn/ui |
| 서버 상태 | TanStack Query v5 |
| 전역 상태 | Zustand |
| HTTP 클라이언트 | Axios |
| 폼 / 유효성 | React Hook Form + Zod |
| 차트 | Recharts |
| 지도 | React Leaflet |
| 파일 업로드 | react-dropzone |
| 알림 | Sonner |
| 날짜 | date-fns |
| 코드 품질 | ESLint + Prettier |

---

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

개발 서버는 기본적으로 `http://localhost:3000` 에서 실행됩니다.

---

## 환경 변수

`.env.example` 파일을 복사해 `.env.local` 을 생성합니다.

```bash
cp .env.example .env.local
```

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | 백엔드 API 베이스 URL |
| `NEXT_PUBLIC_APP_ENV` | 실행 환경 (`development` / `production`) |

---


## 스크립트

| 명령어 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint 검사 |

---

## API 연동

백엔드 API 명세는 `https://api.farmu.kr` 기준으로 작성되어 있습니다.

- 인증 방식: Bearer Token (JWT)
- 공통 헤더: `Authorization`, `X-Union-Id`
- 토큰 만료 시 `/api/v1/auth/refresh` 자동 재발급 처리 (`src/lib/api/instance.ts`)
- 비동기 작업(리포트 생성 등)은 202 응답 후 폴링으로 상태 확인

---

## 사용자 권한

| 역할 | 설명 |
|---|---|
| `UNION_ADMIN` | 조합 전체 관리 |
| `MEMBER` | 개인 성과 · 출하 · 필지 조회 |
| `SUPER_ADMIN` | 시스템 전체 관리 (조합·계정·공지·로그) |

---

## 계정

테스트용 고정 계정입니다. 로그인 시 조합 코드 · 아이디 · 비밀번호를 입력합니다.

| 역할 | 이름 | 조합 코드 | 아이디 | 비밀번호 | 비고 |
|---|---|---|---|---|---|
| 시스템 관리자 | — | (없음) | `system_admin` | `FarmU2026!` | `/admin/login` 으로 로그인 |
| 운영 책임자 | — | `DEMO` | `demo_admin` | `FarmU2026!` | — |
| 조합원 | 김민수 | `DEMO` | `kim_minsoo` | `FarmU2026!` |(mem_demo01) |
| 조합원 | 이서연 | `DEMO` | `lee_seoyeon` | `FarmU2026!` | (mem_demo02) |``