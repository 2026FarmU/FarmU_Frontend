# FarmU 전체 요구사항

> 검증일: 2026-06-28 | farmu.gbsw.hs.kr/openapi.json + 프론트 전체 소스 교차 검증

---

## Chapter 01 — 프론트엔드 버그

담당: 프론트엔드 개발자

### ❌ 필수 수정 5건

#### [필수-1] 빌드 오류 — `src/app/(app)/profile/page.tsx` 삭제
- `@/lib/api/profile` import하는데 파일 없음 → Module not found 빌드 실패
- 네비게이션에 링크 없는 데드 코드. 삭제해도 사용자 영향 없음
- 실제 프로필: `src/app/(app)/settings/profile/page.tsx` (usersApi 사용, 정상)
- **조치: 파일 삭제**

#### [필수-2] 알림 API 함수명·응답키 불일치 (런타임 오류)
`src/components/layout/Header.tsx`
```diff
- notificationsApi.unreadCount()
+ notificationsApi.getUnreadCount()
- r.data.data.unreadCount
+ r.data.data.count
```
`src/components/layout/NotificationModal.tsx`
```diff
- notificationsApi.read(id)
+ notificationsApi.markRead(id)
- notificationsApi.readAll()
+ notificationsApi.markAllRead()
```
실제 정의: `src/lib/api/notifications.ts`

#### [필수-3] `src/lib/api/scenarios.ts` — propose() 이중 슬래시
```diff
- //scenarios/${scenarioId}/propose
+ /scenarios/${scenarioId}/propose
```

#### [필수-4] `src/app/(app)/mentoring/page.tsx` — API 3개 + 타입 오류
```diff
- mentoringApi.getMentorDetail(mentorId, menteeId)
+ mentoringApi.getSuggestionDetail(mentorId, menteeId)

- mentoringApi.listMatches()
+ mentoringApi.getMatches()

- import { mentoringApi, type MentorSuggestion } from '@/lib/api/mentoring'
+ import type { MentorCandidate } from '@/types/mentoring'
```
사용처 타입명 `MentorSuggestion` → `MentorCandidate` 일괄 교체

#### [필수-5] `src/app/(app)/settings/profile/page.tsx` — scenariosApi 함수명
```diff
- scenariosApi.getList(memberId)
+ scenariosApi.list({ memberId })
```

---

### ⚠️ 권장 수정 5건

#### [권장-1] RoleGuard 미적용 페이지 5개
미들웨어는 토큰 유무만 확인. 역할 검사는 페이지 레벨 담당.

| 파일 | 허용 역할 |
|------|-----------|
| `src/app/(app)/shipping/page.tsx` | UNION_ADMIN, MEMBER |
| `src/app/(app)/lands/page.tsx` | UNION_ADMIN, MEMBER |
| `src/app/(app)/reports/page.tsx` | UNION_ADMIN, MEMBER |
| `src/app/(app)/mentoring/page.tsx` | MEMBER |
| `src/app/(app)/settings/profile/page.tsx` | UNION_ADMIN, MEMBER |

패턴: `<RoleGuard allow={['UNION_ADMIN', 'MEMBER']}>{children}</RoleGuard>`

#### [권장-2] MatchStatus 타입 — 백엔드 스키마-2 확인 후 수정
```diff
// src/types/mentoring.ts
- 'REQUESTED' | 'IN_PROGRESS' | 'APPROVED' | 'COMPLETED' | 'REJECTED'
+ 'PENDING' | 'ACTIVE' | 'APPROVED' | 'COMPLETED' | 'REJECTED'
```
페이지에서 PENDING/ACTIVE 사용 중. 백엔드 확인 후 맞춰 수정.

#### [권장-3] 하드코딩 날짜 `'2026-05'` 동적 처리
대상: `me/analysis/page.tsx`, `members/page.tsx`, `settings/profile/page.tsx`
```ts
useState(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
})
```

#### [권장-4] DashboardSummary 타입 이중 정의 정리
`src/types/dashboard.ts`와 `src/lib/api/dashboard.ts` 양쪽에 별도 정의.
`types/dashboard.ts`를 단일 출처로 두고 lib/api에서 import.

#### [권장-5] MEMBER 시나리오 목록 — memberId 미설정 시 빈 목록
`settings/profile/page.tsx`의 `scenariosApi.list({ memberId })` — memberId undefined일 때 빈 목록 반환 가능성. authStore에서 memberId 읽어 기본값 사용.

---

## Chapter 02 — 백엔드 요구사항

담당: 백엔드 개발자

### ❌ 미구현 / 스텁 2건

#### [미구현-1] DELETE /api/v1/reports/{report_id} — 405 반환 중
```
DELETE /api/v1/reports/{report_id}
  Path: report_id* (string, uuid)
  현재: 405 Method Not Allowed
  필요: 204 No Content. 권한: 본인 생성 또는 UNION_ADMIN
```
**워크어라운드:** localStorage `farmu-dismissed-reports`에 id 저장 → 해당 기기에서만 숨김. 기기 바꾸면 재노출.
근거: `reports/page.tsx` 주석 "백엔드 수정 요청 B-R3"

#### [미구현-2] GET /api/v1/reports/{report_id}/download — 68바이트 스텁
```
GET /api/v1/reports/{report_id}/download
  현재: 68바이트 빈 스트림
  필요: 실제 PDF 스트림 OR { data: { downloadUrl } } presigned URL
```
PDF 내용 구성 (report-print 페이지 기준):
1. GET /dashboard/summary → KPI·그룹 분포
2. GET /members/ranking → 조합원 순위
3. GET /reports/{id} 의 `content` 필드 → LLM 마크다운 본문

**워크어라운드:** `/report-print` 새 탭 + `window.print()`로 우회

---

### ⚠️ 범위(Scope) 버그 2건

#### [범위-1] GET /reports — MEMBER 토큰에 타인 리포트 포함 반환
```
GET /api/v1/reports
  Query: unionId? | type?(MEMBER|UNION|MONTHLY) | period? | page? | size?
  현재: MEMBER로 요청해도 타인 MEMBER 리포트 포함 (개인정보 노출)
  필요: MEMBER → 본인 type=MEMBER + 공용(MONTHLY·UNION)만
       UNION_ADMIN → 전체
```
**워크어라운드:** `r.type !== 'MEMBER' || r.memberId === myMemberId` 클라이언트 필터
근거: `reports/page.tsx` 주석 "백엔드 수정 요청 B-R3"

#### [범위-2] POST /reports/generate — 완료 알림 없음
```
POST /api/v1/reports/generate
  Body: { type, unionId?, memberId?, period, format:"PDF"|"XLSX", sections? }
  응답(202): { data: { jobId, status:"PROCESSING"|"COMPLETED", estimatedSeconds } }
  현재: 완료 시 클라이언트 알림 없음 → setTimeout 1500ms 후 목록 invalidate
  권장: 완료 시 type=REPORT_DONE 알림 발송 (알림 시스템 이미 있음)
```

---

### ⚠️ 스키마 확인 필요 2건

#### [스키마-1] GET /notifications/unread-count — 응답 필드명 확인
```
lib/api/notifications.ts 타입: { data: { count: number } }
Header.tsx 코드:           r.data.data.unreadCount  ← 불일치
```
실제 응답 JSON 예시 전달 바람. (`count` vs `unreadCount`)

#### [스키마-2] GET /mentoring/matches — MatchStatus 실제 enum 값 확인
```
types/mentoring.ts:         REQUESTED · IN_PROGRESS · APPROVED · COMPLETED · REJECTED
페이지 렌더링 사용값:        PENDING · ACTIVE · APPROVED · COMPLETED · REJECTED
```
실제 enum 목록 확인 후 프론트에 전달. 프론트는 `types/mentoring.ts` 수정.

---

### 🔵 경로 확인 필요 4건

#### [경로-1] POST /livestock
```
POST /api/v1/livestock
  Body:
    livestockId*   string       개체 번호
    currentWeight* number       현재 체중 (kg)
    targetWeight*  number       목표 체중 (kg)
    baseRevenue*   number       기준 수익 (원, ×10000 변환 후)
    observedAt*    yyyy-MM-dd   측정일
  기대 응답: { data: { livestockRecordId, recommendation: ShippingRecommendation } }
```
참조: `src/lib/api/shipping.ts:registerLivestock()`

#### [경로-2] GET /unions/members
```
GET /api/v1/unions/members
  기대 응답: { data: [{ userId, memberId, name, loginId, status:"ACTIVE", landCount, lastLoginAt }] }
```
참조: `src/lib/api/members.ts:list()` ← 시나리오 조합원 드롭다운용

#### [경로-3] POST /data/ai-draft
```
POST /api/v1/data/ai-draft
  Body:
    dataType* string   MEMBER_PERFORMANCE·SHIPPING_HISTORY·LIVESTOCK·SALES·LAND
    period*   yyyy-MM  대상 기간
  기대 응답: { data: { uploadId, status:"DRAFT", rows: [] } }
```

#### [경로-4] ANTHROPIC_API_KEY 설정
`src/app/api/ai/report/route.ts` — 키 미설정 시 하드코딩 목업 반환.
코드 변경 불필요. 배포 환경에 `ANTHROPIC_API_KEY=sk-ant-…` 추가만 하면 Claude 호출 코드 자동 활성화.

---

## Chapter 03 — 전체 API 파라미터 레퍼런스

### Auth

| 엔드포인트 | 요청 | 응답 |
|-----------|------|------|
| POST /auth/login | `{ loginId*, password*, unionCode* }` | `{ accessToken, refreshToken, expiresIn, user:{userId,name,role,unionId,unionName?} }` |
| POST /auth/register | `{ loginId*, password*, name*, unionCode* }` | `{ userId }` (role=MEMBER 고정) |
| POST /auth/refresh | `{ refreshToken* }` | `{ accessToken, refreshToken }` |
| GET /auth/me | — | `{ userId, name, role, unionId, permissions[], memberId? }` |
| POST /auth/logout | — | 204 |

### Dashboard

| 엔드포인트 | 파라미터 | 응답 주요 필드 |
|-----------|---------|--------------|
| GET /dashboard/summary | `unionId*, period*` | avgScore, scoreDelta, memberCount, groupDistribution{top,mid,low}, kpi{shippingHitRate,avgRevenue,reportTimeReduced}, availablePeriods[] |
| GET /dashboard/trends | `unionId*, from*, to*, metric*` | `{ metric, series:[{group:"avg"|"top"|"low", points:[{period,value}]}] }` |
| GET /dashboard/alerts | `unionId*` | `[{ id, level:"HIGH"|"MEDIUM"|"LOW", title, message, affectedMembers, createdAt }]` |
| POST /dashboard/alerts/{id}/dismiss | — | 204 |

### Members

| 엔드포인트 | 파라미터 | 응답 주요 필드 |
|-----------|---------|--------------|
| GET /members/ranking | `unionId*, period*, group?(TOP|MID|LOW), page?, size?` | rank, memberId, name, mainCrop, region, totalScore, group, scoreChange, availablePeriods[] |
| GET /members/{id}/analysis | path: `id*` (또는 "me"), query: `period*` | memberId, totalScore, scoreDelta, rank, rankTotal, group, components{production,shipping,revenue,quality,costEfficiency}, scoreHistory[], cropSuitability[], xaiFactors[], improvementTasks[] |
| GET /unions/members | — | `[{ userId, memberId, name, loginId, status, landCount, lastLoginAt }]` |

### Lands

| 엔드포인트 | 파라미터 | 응답 주요 필드 |
|-----------|---------|--------------|
| GET /lands | `memberId?, query?, page?, size?` | `[{ landId, memberId, name, pnu, address, latitude, longitude, area, mainCrop, headCount? }]` |
| POST /lands | `{ name*, pnu*, address*, latitude*, longitude*, area*, mainCrop?, headCount?, memberId? }` | `{ landId }` |
| DELETE /lands/{id} | path: `land_id*` | 204 |
| GET /lands/{id}/suitability | path: `land_id*` | `{ currentCrop?, candidates:[{crop, suitabilityScore, rank, factors?, riskFactors?, expectedRevenuePerHa?}] }` |

### Scenarios

| 엔드포인트 | 파라미터 | 설명 |
|-----------|---------|------|
| POST /scenarios/simulate | `{ memberId*, landId*, changes:{fromCrop*, toCrop*, applyAreaRatio*(0~1), startPeriod*} }` | 시뮬레이션 결과: baseline, projected, delta, timeline[], risks[], confidence |
| POST /scenarios/{id}/save | `{ scenarioId*, name* }` | 저장 |
| GET /scenarios | `memberId?, size?` | 목록 |
| GET /scenarios/{id} | — | 상세 |
| POST /scenarios/{id}/propose | `{ targetMemberId*, message* }` | 제안 발송 |
| DELETE /scenarios/{id} | — | 삭제 |

### Shipping

| 엔드포인트 | 파라미터 | 응답 주요 필드 |
|-----------|---------|--------------|
| GET /shipping/recommendations | `unionId?, memberId?, status?(PENDING|ACCEPTED|REJECTED)` | `[{ id, memberId, livestockId, currentWeight, targetWeight, recommendedDate, recommendedAction:"SHIP"|"HOLD"|"SPLIT_SHIP"|"REVIEW", confidence, expectedRevenue{min,expected,max}, riskFactors[], rationale }]` |
| POST /shipping/recommendations/{id}/decision | `{ decision*:"ACCEPTED"|"REJECTED", actualShipDate?, memo? }` | — |
| GET /shipping/accuracy | `unionId*, from*(yyyy-MM), to*(yyyy-MM)` | `{ overallHitRate, monthly:[{period, totalRecommendations, accepted, hitRate}] }` |
| POST /livestock | `{ livestockId*, currentWeight*, targetWeight*, baseRevenue*, observedAt* }` | `{ livestockRecordId, recommendation }` |

### Mentoring

| 엔드포인트 | 파라미터 | 응답 주요 필드 |
|-----------|---------|--------------|
| GET /mentoring/suggestions | `menteeId*, size?` | `[{ mentorId, name, crop, region, mentorScore, matchScore, helpAreas[], matchReasons[], distanceKm }]` |
| GET /mentoring/suggestions/{mentor_id} | path: `mentor_id*`, query: `menteeId*` | mentorId, name, crop, years, region, mentorScore, matchScore, reason, tags[], matchFactors[], comparison[], helpAreas[] |
| GET /mentoring/matches | `status?, page?, size?` | 매칭 목록 |
| POST /mentoring/matches | `{ mentorId*, menteeId*, goal*, helpAreas? }` | `{ matchId, status }` |
| POST /mentoring/matches/{id}/approve | — | 승인 |
| POST /mentoring/matches/{id}/reject | — | 거절 |
| GET /mentoring/stats | — | `{ active, completed, pending, availableMentors }` |
| GET /mentoring/matches/{id}/tasks | — | 과제 목록 |
| POST /mentoring/matches/{id}/tasks | `{ title*, description?, dueDate?, completed? }` | `{ taskId, matchId, title, description, dueDate, completed, createdAt }` |
| PATCH /mentoring/matches/{id}/tasks/{task_id} | `{ title?, description?, dueDate?, completed? }` | 과제 수정 |

### Notifications

| 엔드포인트 | 파라미터 | 응답 |
|-----------|---------|------|
| GET /notifications/unread-count | — | `{ count }` ← 필드명 스키마-1 확인 필요 |
| GET /notifications | `size?` | `[{ id, type, title, message, level:"high"|"medium"|"low", isRead, actionUrl?, createdAt }]` |
| POST /notifications/{id}/read | — | 단건 읽음 |
| POST /notifications/read-all | — | 전체 읽음 |

### Reports

| 엔드포인트 | 파라미터 | 설명 |
|-----------|---------|------|
| POST /reports/generate | `{ type*:"MEMBER"|"UNION"|"MONTHLY", period*, format*:"PDF"|"XLSX", unionId?, memberId?, sections? }` | 202: `{ jobId, status:"PROCESSING"|"COMPLETED", estimatedSeconds }` |
| GET /reports | `unionId?, type?, period?, page?, size?` | 목록. 범위-1 버그 참조 |
| GET /reports/{id} | — | `{ id, type, status, generatedAt, format, downloadUrl?, content? }` |
| DELETE /reports/{id} | — | **미구현-1 — 405 반환 중** |
| GET /reports/{id}/download | — | **미구현-2 — 68바이트 스텁** |

### Settings / Users / Data / Admin / AI

```
# Settings
GET  /settings/weights
PATCH /settings/weights  body: { production, shipping, revenue }  (합계=100)

# Users
GET   /users/me
PATCH /users/me          body: { name?, phone?, email?, bio?, region?, mainCrop?, livestock?, unionName? }
PATCH /users/me/password body: { currentPassword, newPassword }
PATCH /users/me/images   multipart: avatar 또는 banner 파일
GET   /users/me/notifications
PUT   /users/me/notifications  body: { settings:[{ key, channels:["PUSH"|"EMAIL"], enabled }] }
  알림 key: RISK_ALERT·SHIPPING_NEW·REPORT_DONE·SCENARIO_DONE·MATCH_STATUS·MATCH_REQUEST·UPLOAD_VALIDATED

# Data
GET  /data/uploads
POST /data/uploads        multipart: { file, dataType }
  dataType: MEMBER_PERFORMANCE·SHIPPING_HISTORY·LIVESTOCK·SALES·LAND
POST /data/uploads/{id}/apply  body: { skipErrors:false, applyWarnings:true }
POST /data/ai-draft       body: { dataType, period }  ← 경로-3 확인 필요

# Admin
GET  /admin/stats
GET  /admin/unions         query: page?, size?
POST /admin/unions         body: { code, name, isActive? }
PATCH /admin/unions/{id}   body: { isActive }
GET  /admin/users          query: role?, page?, size?
POST /admin/users/{id}/disable
POST /admin/users/{id}/restore
POST /admin/users/{id}/reset-password  body: { password }
GET  /admin/logs           query: page?, size?
GET  /admin/notices        query: page?, size?
POST /admin/notices        body: { title, content, targetRole:"ALL"|"UNION_ADMIN"|"MEMBER" }
DELETE /admin/notices/{id}

# AI
GET  /ai/status
POST /ai/advice  body: { topic*, question*, crop?, region?, context? }
  응답: { summary, actions:string[], riskFactors:string[] }
```
