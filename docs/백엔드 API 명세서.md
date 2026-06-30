# 팜유 API 명세서 v1

추후 swagger 이용예정

---

## Overview

### 인증

모든 인증이 필요한 API는 요청 헤더에 Bearer 토큰을 포함해야 합니다.

```json
Authorization: Bearer {accessToken}
```

토큰이 없거나 유효하지 않은 경우 `401` 응답을 반환합니다. 토큰이 만료된 경우 `/api/v1/auth/refresh`를 통해 재발급 받아야 합니다.

### Base URL

```json
https://api.farmu.kr
```

### 공통 헤더

| 헤더 | 필수 | 설명 |
| --- | --- | --- |
| Authorization | O | `Bearer {accessToken}` (인증 API 제외) |
| Content-Type | O | `application/json` (파일 업로드 시 `multipart/form-data`) |
| X-Union-Id | △ | 조합 컨텍스트 ID (운영 책임자가 여러 조합 접근 시) |

### 공통 규칙 (전 API 적용)

프론트-백엔드 정합성을 위해 아래 규칙을 모든 응답에 일관 적용합니다. (부록 "결정 사항" 참고)

| 항목 | 규칙 |
| --- | --- |
| **역할(role)** | **2개만 사용: `UNION_ADMIN`(운영 책임자) / `MEMBER`(조합원).** 운영 책임자가 **관리자 + 컨설턴트(코디네이터) 역할을 겸임**한다. **`CONSULTANT`는 별도 역할로 두지 않음**(기존 표기는 폐기). 매칭 승인 등 "코디네이터" 동작도 `UNION_ADMIN` 권한으로 수행 |
| 식별자 | 조합원·멘토는 **외부 노출용 단일 ID** 사용 (`memberId`, `mentorId` = 동일 체계, 예 `mem_087`). 모든 path·응답 id가 이 값. 내부 PK·표시용 코드를 따로 노출하지 않음 |
| 비율·점수 단위 | 적중률·단축률·적합도·성과율·매칭점수·변화율 등 **사용자에게 표시되는 모든 비율·점수는 `%` 정수 0~100**으로 통일. 금액은 원 단위 정수. 예외(0~1 유지): **모델 신뢰도(`confidence`)·위험 가중치(`riskFactors[].score`)** 및 **입력 파라미터 비율(`applyAreaRatio` 등)** |
| 성과 그룹 | enum **`TOP` / `MID` / `LOW`** 고정 (한글 라벨 상위/중위/개선필요는 프론트가 매핑). 분포 키도 `top/mid/low` |
| 기간(period) | `yyyy-MM`. **선택값** — 생략 시 최신 집계월 반환, 응답에 `availablePeriods`(선택 가능 월 목록) 동봉 |
| 카테고리 enum | 개선과제·도움영역 공통: **`PRODUCTION`, `SHIPPING`, `REVENUE`, `QUALITY`, `COST`, `CROP_CHANGE`, `CONNECT`** |
| 빈/부족 데이터 | 추이·이력 등 시계열은 **있는 만큼만**(가변 길이) 반환. null 패딩하지 않음 |

---

## 성공 응답 구조

### 데이터 응답 (200)

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "id" : "mem_8f3a",
    "name" : "김조합원"
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data | Object | O | 응답 데이터 |
| data.id | String | O | ID |
| data.name | String | O | 이름 |

### 빈 응답 (201, 204)

생성(201) 및 삭제·수정(204) 등 응답 바디가 없는 경우 빈 응답을 반환합니다.

### 페이지네이션 응답

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : [ {
    "id" : "mem_8f3a",
    "name" : "김조합원"
  } ],
  "page" : 0,
  "size" : 20,
  "totalElements" : 142,
  "totalPages" : 8,
  "hasNext" : true
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data | Array | O | 응답 데이터 |
| page | Number | O | 현재 페이지 (0부터 시작) |
| size | Number | O | 페이지 크기 |
| totalElements | Number | O | 전체 데이터 수 |
| totalPages | Number | O | 전체 페이지 수 |
| hasNext | Boolean | O | 다음 페이지 존재 여부 |

### 비동기 작업 응답 (202)

리포트 생성, 시나리오 시뮬레이션, 데이터 검증 등 장시간 작업은 `202 Accepted`로 응답합니다.

```json
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "data" : {
    "jobId" : "job_5e8f",
    "status" : "PROCESSING",
    "estimatedSeconds" : 45,
    "pollingUrl" : "/api/v1/reports/rpt_5e8f"
  }
}
```

---

## 에러 응답 구조

모든 에러 응답은 RFC 9457 ProblemDetail 형식을 따릅니다.

### 비즈니스 예외

```json
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type" : "about:blank",
  "title" : "Bad Request",
  "status" : 400,
  "detail" : "이미 사용 중인 조합 코드입니다.",
  "instance" : "/api/v1/unions",
  "properties" : {
    "timestamp" : "2026-05-27T10:31:26.054484412Z",
    "code" : "DUPLICATE_UNION_CODE"
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| type | String | O | 에러 타입 |
| title | String | O | HTTP 상태 메시지 |
| status | Number | O | HTTP 상태 코드 |
| detail | String | O | 에러 상세 메시지 |
| instance | String | O | 요청 URI |
| properties.timestamp | String | O | 에러 발생 시간 |
| properties.code | String | O | 에러 코드 |

### 유효성 검증 실패

```json
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type" : "about:blank",
  "title" : "Bad Request",
  "status" : 400,
  "detail" : "weights: 가중치 합계는 100이어야 합니다",
  "instance" : "/api/v1/unions/uni_001/weights",
  "properties" : {
    "timestamp" : "2026-05-27T10:31:26.102295797Z",
    "code" : "INVALID_REQUEST"
  }
}
```

### 서버 에러

```json
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json

{
  "type" : "about:blank",
  "title" : "Internal Server Error",
  "status" : 500,
  "detail" : "서버 내부 오류가 발생했습니다.",
  "instance" : "/api/v1/dashboard/summary",
  "properties" : {
    "timestamp" : "2026-05-27T10:31:26.117895682Z",
    "code" : "INTERNAL_SERVER_ERROR"
  }
}
```

---

## 에러 코드

### 공통

| 코드 | HTTP 상태 | 설명 |
| --- | --- | --- |
| INVALID_REQUEST | 400 | 잘못된 요청 |
| INTERNAL_SERVER_ERROR | 500 | 서버 내부 오류 |
| EXTERNAL_API_FAILED | 502 | 외부 공공데이터 API 호출 실패 |

### 인증/권한

| 코드 | HTTP 상태 | 설명 |
| --- | --- | --- |
| INVALID_REFRESH_TOKEN | 401 | 유효하지 않은 리프레시 토큰 |
| EXPIRED_REFRESH_TOKEN | 401 | 만료된 리프레시 토큰 |
| EXPIRED_ACCESS_TOKEN | 401 | 만료된 액세스 토큰 |
| FORBIDDEN_ROLE | 403 | 권한 없음 (역할 부족) |
| WITHDRAWN_USER | 403 | 탈퇴한 회원 |
| INVALID_CREDENTIALS | 401 | 아이디 또는 비밀번호 불일치 |

### 사용자/조합

| 코드 | HTTP 상태 | 설명 |
| --- | --- | --- |
| USER_NOT_FOUND | 404 | 사용자를 찾을 수 없음 |
| UNION_NOT_FOUND | 404 | 조합을 찾을 수 없음 |
| MEMBER_NOT_FOUND | 404 | 조합원을 찾을 수 없음 |
| DUPLICATE_LOGIN_ID | 409 | 이미 사용 중인 로그인 ID |

### 성과/분석

| 코드 | HTTP 상태 | 설명 |
| --- | --- | --- |
| PERFORMANCE_NOT_CALCULATED | 404 | 해당 기간 성과 미산정 |
| INVALID_WEIGHT_SUM | 400 | 가중치 합계 오류(100 아님) |
| INSUFFICIENT_DATA | 422 | 분석에 필요한 데이터 부족 |

### 출하/시나리오

| 코드 | HTTP 상태 | 설명 |
| --- | --- | --- |
| RECOMMENDATION_NOT_FOUND | 404 | 출하 추천을 찾을 수 없음 |
| RECOMMENDATION_ALREADY_DECIDED | 409 | 이미 채택/거절된 추천 |
| SCENARIO_SIMULATION_FAILED | 500 | 시나리오 시뮬레이션 실패 |

### 필지/작목

| 코드 | HTTP 상태 | 설명 |
| --- | --- | --- |
| LAND_NOT_FOUND | 404 | 필지를 찾을 수 없음 |
| PNU_NOT_REGISTERED | 404 | 등록되지 않은 필지(PNU) |
| SUITABILITY_DATA_UNAVAILABLE | 422 | 적합도 분석 데이터 없음 |

### 멘토링

| 코드 | HTTP 상태 | 설명 |
| --- | --- | --- |
| MATCH_NOT_FOUND | 404 | 매칭을 찾을 수 없음 |
| MATCH_NOT_APPROVABLE | 409 | 승인할 수 없는 상태 |
| MENTOR_UNAVAILABLE | 409 | 멘토 매칭 한도 초과 |

### 리포트/데이터

| 코드 | HTTP 상태 | 설명 |
| --- | --- | --- |
| REPORT_NOT_FOUND | 404 | 리포트를 찾을 수 없음 |
| REPORT_NOT_READY | 409 | 리포트 생성 중 |
| UPLOAD_NOT_FOUND | 404 | 업로드를 찾을 수 없음 |
| VALIDATION_FAILED | 422 | 데이터 검증 실패 |
| FILE_TOO_LARGE | 413 | 파일 크기 초과 |
| UNSUPPORTED_FILE_TYPE | 415 | 지원하지 않는 파일 형식 |

---

## 인증 API

### 로그인

### Request

```json
POST /api/v1/auth/login HTTP/1.1
Content-Type: application/json
Host: api.farmu.kr

{
  "loginId" : "farmu01",
  "password" : "string",
  "unionCode" : "U00123"
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| loginId | String | O | 로그인 ID |
| password | String | O | 비밀번호 |
| unionCode | String | O | 조합 코드 |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "accessToken" : "access-token",
    "refreshToken" : "refresh-token",
    "expiresIn" : 3600,
    "user" : {
      "userId" : "usr_8f3a",
      "name" : "김조합",
      "role" : "UNION_ADMIN",
      "unionId" : "uni_001"
    }
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.accessToken | String | O | 액세스 토큰 |
| data.refreshToken | String | O | 리프레시 토큰 |
| data.expiresIn | Number | O | 액세스 토큰 만료 시간(초) |
| data.user.userId | String | O | 사용자 ID |
| data.user.name | String | O | 사용자 이름 |
| data.user.role | String | O | 권한 (**UNION_ADMIN, MEMBER** — 2개. 운영 책임자가 컨설턴트 겸임) |
| data.user.unionId | String | O | 소속 조합 ID |

### 토큰 재발급

### Request

```json
POST /api/v1/auth/refresh HTTP/1.1
Content-Type: application/json

{
  "refreshToken" : "refresh-token"
}
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "accessToken" : "new-access-token",
    "refreshToken" : "new-refresh-token"
  }
}
```

### 로그아웃

### Request

```json
POST /api/v1/auth/logout HTTP/1.1
Host: api.farmu.kr
```

### Response

```json
HTTP/1.1 204 No Content
```

### **사용자 생성(관리자)**

### **Request**

```json
POST /api/v1/auth/register HTTP/1.1
Content-Type: application/json
Authorization: Bearer {accessToken}
Host: api.farmu.kr

{
  "loginId" : "farmu02",
  "password" : "string",
  "name" : "신규조합원",
  "role" : "MEMBER"
}
```

| **Path** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| Authorization | String | O | 관리자 액세스 토큰 (UNION_ADMIN) |
| loginId | String | O | 로그인 ID |
| password | String | O | 비밀번호 |
| name | String | O | 사용자 이름 |
| role | String | X | 권한 (기본값: MEMBER, **허용값: UNION_ADMIN, MEMBER** — 2개) |

### **Response**

```json
HTTP/1.1 201 Created
Content-Type: application/json

{
  "data" : {
    "userId" : "usr_8f3a"
  }
}
```

| **Path** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| data.userId | String | O | 생성된 사용자 ID |

### 내 정보 조회

### Request

```json
GET /api/v1/auth/me HTTP/1.1
Host: api.farmu.kr
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "userId" : "usr_8f3a",
    "name" : "김조합",
    "role" : "UNION_ADMIN",
    "unionId" : "uni_001",
    "permissions" : [ "dashboard.read", "member.write", "report.export" ]
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.userId | String | O | 사용자 ID |
| data.name | String | O | 이름 |
| data.role | String | O | 권한 (**UNION_ADMIN, MEMBER** — 2개. 운영 책임자가 컨설턴트 겸임) |
| data.unionId | String | O | 소속 조합 ID |
| data.permissions | Array | O | 권한 목록 |

---

## 설정/계정 API

프로필 화면(`/settings/profile`)의 정보 수정·비밀번호 변경·알림 설정·권한 이양·계정 비활성화에 대응. 대상은 **로그인 사용자 본인**(`/me`)입니다.

### 프로필 수정

### Request

```json
PATCH /api/v1/me/profile HTTP/1.1
Content-Type: application/json

{
  "name" : "김조합원",
  "phone" : "010-1234-5678",
  "email" : "member@example.com",
  "bio" : "사과 7년차"
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| name | △ | 이름 |
| phone | △ | 연락처 |
| email | △ | 이메일 |
| bio | △ | 소개 (변경할 필드만 전송) |

### Response

```json
HTTP/1.1 204 No Content
```

### 비밀번호 변경

### Request

```json
PATCH /api/v1/auth/password HTTP/1.1
Content-Type: application/json

{
  "currentPassword" : "old-pw",
  "newPassword" : "new-pw"
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| currentPassword | O | 현재 비밀번호 |
| newPassword | O | 새 비밀번호 |

### Response

```json
HTTP/1.1 204 No Content
```

현재 비밀번호 불일치 시 `400 INVALID_PASSWORD`.

### 프로필/배너 이미지 변경

### Request

```json
PATCH /api/v1/me/images HTTP/1.1
Content-Type: multipart/form-data

avatar=@avatar.png
banner=@banner.png
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| avatar | △ | 프로필 사진 파일 |
| banner | △ | 배너 이미지 파일 (둘 중 보낸 것만 갱신) |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "avatarUrl" : "https://cdn.farmu.kr/avatar/mem_087.png",
    "bannerUrl" : "https://cdn.farmu.kr/banner/mem_087.png"
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.avatarUrl | String | O | 프로필 사진 URL |
| data.bannerUrl | String | O | 배너 이미지 URL |

### 알림 설정 조회

### Request

```json
GET /api/v1/me/notifications HTTP/1.1
Host: api.farmu.kr
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : [ {
    "group" : "안전·위험",
    "items" : [ {
      "key" : "RISK_ALERT",
      "title" : "위험 알림 (HIGH)",
      "description" : "가격 폭락 · 기상 이상 · 수급 충격",
      "channels" : [ "PUSH", "EMAIL" ],
      "enabled" : true
    } ]
  } ]
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data[].group | String | O | 알림 그룹명 |
| data[].items[].key | String | O | 알림 항목 키 |
| data[].items[].title | String | O | 항목 제목 |
| data[].items[].description | String | O | 항목 설명 |
| data[].items[].channels | Array | O | 수신 채널 (PUSH, EMAIL) |
| data[].items[].enabled | Boolean | O | 수신 여부 |

### 알림 설정 수정

### Request

```json
PUT /api/v1/me/notifications HTTP/1.1
Content-Type: application/json

{
  "settings" : [
    { "key" : "RISK_ALERT", "channels" : [ "PUSH", "EMAIL" ], "enabled" : true },
    { "key" : "SCENARIO_DONE", "channels" : [ "PUSH" ], "enabled" : false }
  ]
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| settings[].key | O | 알림 항목 키 |
| settings[].channels | O | 수신 채널 (PUSH, EMAIL) |
| settings[].enabled | O | 수신 여부 |

### Response

```json
HTTP/1.1 204 No Content
```

### 운영 책임자 권한 이양

운영 책임자(UNION_ADMIN)가 **자기 조합 내 조합원에게 권한을 이양**합니다. 이양 후 본인은 MEMBER로 전환됩니다. (UNION_ADMIN 전용)

### Request

```json
POST /api/v1/me/transfer-admin HTTP/1.1
Content-Type: application/json

{
  "targetMemberId" : "mem_201"
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| targetMemberId | O | 권한을 받을 조합원 ID |

### Response

```json
HTTP/1.1 204 No Content
```

### 전체 기기 로그아웃

발급된 모든 토큰을 폐기합니다. (단일 기기 로그아웃 `POST /auth/logout`과 구분)

### Request

```json
POST /api/v1/auth/logout?allDevices=true HTTP/1.1
Host: api.farmu.kr
```

| Name | Required | Description |
| --- | --- | --- |
| allDevices | △ | true 시 전체 기기 토큰 폐기 (기본 false) |

### Response

```json
HTTP/1.1 204 No Content
```

### 계정 비활성화

로그인 불가 처리 후 30일 뒤 영구 삭제됩니다.

### Request

```json
DELETE /api/v1/me HTTP/1.1
Host: api.farmu.kr
```

### Response

```json
HTTP/1.1 204 No Content
```

---

## 관리자(SUPER_ADMIN) API

> **역할:** `SUPER_ADMIN` — 플랫폼 전체(다중 조합)를 관리하는 최상위 관리자.  
> 모든 요청에 `Authorization: Bearer <token>` 필요. `X-Union-Id` 헤더 불필요(전 조합 접근).  
> 프론트 라우트: `/admin`

---

### 플랫폼 통계 조회

### Request

```json
GET /api/v1/admin/stats HTTP/1.1
Host: api.farmu.kr
Authorization: Bearer {token}
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "totalUnions": 3,
    "totalMembers": 120,
    "totalAdmins": 3,
    "activeUsers30d": 87,
    "newMembersThisMonth": 12
  }
}
```

---

### 조합 목록 조회

### Request

```json
GET /api/v1/admin/unions HTTP/1.1
Host: api.farmu.kr
Authorization: Bearer {token}
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": [
    {
      "unionId": "uni_001",
      "unionCode": "DEMO",
      "name": "DEMO 농협",
      "adminCount": 1,
      "memberCount": 3,
      "status": "ACTIVE",
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### 조합 생성

### Request

```json
POST /api/v1/admin/unions HTTP/1.1
Host: api.farmu.kr
Authorization: Bearer {token}
Content-Type: application/json

{
  "unionCode": "ANSEONG",
  "name": "안성농협",
  "region": "경기도 안성시"
}
```

### Response

```json
HTTP/1.1 201 Created
Content-Type: application/json

{
  "data": {
    "unionId": "uni_002",
    "unionCode": "ANSEONG"
  }
}
```

---

### 조합 상태 변경 (활성/비활성)

### Request

```json
PATCH /api/v1/admin/unions/{unionId} HTTP/1.1
Host: api.farmu.kr
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "INACTIVE"
}
```

### Response

```json
HTTP/1.1 200 OK
```

---

### 전체 사용자 목록 조회

### Request

```json
GET /api/v1/admin/users?role=MEMBER&unionId=uni_001&page=0&size=50 HTTP/1.1
Host: api.farmu.kr
Authorization: Bearer {token}
```

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `role` | `UNION_ADMIN` \| `MEMBER` | 역할 필터 (생략 시 전체) |
| `unionId` | string | 조합 필터 (생략 시 전체) |
| `page` | int | 페이지 (0부터) |
| `size` | int | 페이지 크기 (기본 50) |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "content": [
      {
        "userId": "usr_001",
        "loginId": "kim_minsoo",
        "name": "김민수",
        "role": "MEMBER",
        "unionId": "uni_001",
        "unionCode": "DEMO",
        "status": "ACTIVE",
        "lastLoginAt": "2026-06-18T09:00:00Z",
        "createdAt": "2026-01-15T00:00:00Z"
      }
    ],
    "totalElements": 3,
    "totalPages": 1
  }
}
```

---

### 계정 강제 비활성화

로그인 불가 처리 후 30일 뒤 영구 삭제.

### Request

```json
DELETE /api/v1/admin/users/{userId} HTTP/1.1
Host: api.farmu.kr
Authorization: Bearer {token}
```

### Response

```json
HTTP/1.1 204 No Content
```

---

### 계정 복구 (비활성화 취소)

비활성화된 계정을 다시 활성 상태로 복구합니다. 영구 삭제(30일 경과) 전에만 가능합니다.

### Request

```json
POST /api/v1/admin/users/{userId}/restore HTTP/1.1
Host: api.farmu.kr
Authorization: Bearer {token}
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "userId": "usr_001",
    "loginId": "kim_minsoo",
    "name": "김민수",
    "isWithdrawn": false
  }
}
```

---

### 비밀번호 초기화

임시 비밀번호를 설정하고 다음 로그인 시 강제 변경 처리.

### Request

```json
POST /api/v1/admin/users/{userId}/reset-password HTTP/1.1
Host: api.farmu.kr
Authorization: Bearer {token}
Content-Type: application/json

{
  "newPassword": "TempPass2026!"
}
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "temporaryPassword": "TempPass2026!"
  }
}
```

---

### 접속 로그 조회

### Request

```json
GET /api/v1/admin/logs?page=0&size=50&unionId=uni_001 HTTP/1.1
Host: api.farmu.kr
Authorization: Bearer {token}
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "content": [
      {
        "logId": "log_001",
        "userId": "usr_001",
        "name": "김민수",
        "role": "MEMBER",
        "unionCode": "DEMO",
        "action": "LOGIN",
        "ip": "125.x.x.x",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2026-06-18T09:00:00Z"
      }
    ],
    "totalElements": 142,
    "totalPages": 3
  }
}
```

---

### 시스템 공지 목록 조회

### Request

```json
GET /api/v1/admin/notices HTTP/1.1
Host: api.farmu.kr
Authorization: Bearer {token}
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": [
    {
      "noticeId": "ntc_001",
      "title": "6월 정기 점검 안내",
      "body": "2026-06-20 02:00~04:00 점검이 진행됩니다.",
      "targetRole": "ALL",
      "createdAt": "2026-06-18T10:00:00Z"
    }
  ]
}
```

---

### 시스템 공지 등록

### Request

```json
POST /api/v1/admin/notices HTTP/1.1
Host: api.farmu.kr
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "6월 정기 점검 안내",
  "body": "2026-06-20 02:00~04:00 점검이 진행됩니다.",
  "targetRole": "ALL"
}
```

`targetRole`: `ALL` | `UNION_ADMIN` | `MEMBER`

### Response

```json
HTTP/1.1 201 Created

{
  "data": { "noticeId": "ntc_001" }
}
```

---

### 시스템 공지 삭제

### Request

```json
DELETE /api/v1/admin/notices/{noticeId} HTTP/1.1
Host: api.farmu.kr
Authorization: Bearer {token}
```

### Response

```json
HTTP/1.1 204 No Content
```

---

## 대시보드 API

### 조합 KPI 요약 조회

### Request

```json
GET /api/v1/dashboard/summary?unionId=uni_001&period=2026-05 HTTP/1.1
Host: api.farmu.kr
```

| Name | Required | Description |
| --- | --- | --- |
| unionId | O | 조합 ID |
| period | O | 조회 기간 (yyyy-MM) |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "unionId" : "uni_001",
    "period" : "2026-05",
    "avgScore" : 78.3,
    "scoreDelta" : 2.1,
    "memberCount" : 142,
    "groupDistribution" : {
      "top" : 28,
      "mid" : 89,
      "low" : 25
    },
    "kpi" : {
      "shippingHitRate" : 84,
      "avgRevenue" : 12500000,
      "reportTimeReduced" : 71
    },
    "lastUpdated" : "2026-05-27T09:00:00+09:00"
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.unionId | String | O | 조합 ID |
| data.period | String | O | 조회 기간 |
| data.avgScore | Number | O | 평균 성과율 |
| data.scoreDelta | Number | O | 전월 대비 변화량(%p) |
| data.memberCount | Number | O | 조합원 수 |
| data.groupDistribution.top | Number | O | 상위(TOP) 그룹 인원 |
| data.groupDistribution.mid | Number | O | 중위(MID) 그룹 인원 |
| data.groupDistribution.low | Number | O | 개선필요(LOW) 그룹 인원 |
| data.kpi.shippingHitRate | Number | O | 출하 적중률 (%, 0~100) |
| data.kpi.avgRevenue | Number | O | 평균 수익(원) |
| data.kpi.reportTimeReduced | Number | O | 보고서 시간 단축률 (%, 0~100) |
| data.lastUpdated | String | O | 마지막 갱신 시간 |

### 월별 성과율 추이

### Request

```json
GET /api/v1/dashboard/trends?unionId=uni_001&from=2026-01&to=2026-05&metric=score HTTP/1.1
Host: api.farmu.kr
```

| Name | Required | Description |
| --- | --- | --- |
| unionId | O | 조합 ID |
| from | O | 시작 월 (yyyy-MM) |
| to | O | 종료 월 (yyyy-MM) |
| metric | O | 지표 (score, revenue, shippingHitRate, production) |

### Response

> **다중 시리즈** (B-3 결정 A). 프론트 대시보드 추이 차트는 **전체 평균 / 상위 / 개선 필요 3개 라인**을 한 차트에 그리므로, `series`를 그룹별 배열로 내려준다. 같은 기간 집합(from~to)을 공유.

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "metric" : "score",
    "series" : [
      { "group" : "avg", "label" : "전체 평균", "points" : [ { "period" : "2026-01", "value" : 72.1 }, { "period" : "2026-05", "value" : 78.3 } ] },
      { "group" : "top", "label" : "상위 그룹",  "points" : [ { "period" : "2026-01", "value" : 85.4 }, { "period" : "2026-05", "value" : 88.2 } ] },
      { "group" : "low", "label" : "개선 필요",  "points" : [ { "period" : "2026-01", "value" : 54.8 }, { "period" : "2026-05", "value" : 59.6 } ] }
    ]
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.metric | String | O | 지표명 (score, revenue, shippingHitRate, production) |
| data.series[].group | String | O | 그룹 키 **`avg` / `top` / `low`** (전체평균/상위/개선필요) |
| data.series[].label | String | O | 한글 라벨 (차트 범례용) |
| data.series[].points[].period | String | O | 기간 (yyyy-MM) |
| data.series[].points[].value | Number | O | 값 |

### 위험 알림 목록

### Request

```json
GET /api/v1/dashboard/alerts?unionId=uni_001&level=HIGH&status=ACTIVE&page=0&size=10 HTTP/1.1
Host: api.farmu.kr
```

| Name | Required | Description |
| --- | --- | --- |
| unionId | O | 조합 ID |
| level | X | 위험도 (HIGH, MEDIUM, LOW) |
| status | X | 상태 (ACTIVE, DISMISSED) |
| page | X | 페이지 번호 (기본 0) |
| size | X | 페이지 크기 (기본 10) |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : [ {
    "id" : "alt_2a91",
    "level" : "HIGH",
    "type" : "PRICE_DROP",
    "title" : "한우 거세 가격 7일 연속 하락",
    "message" : "지난주 대비 -8.2%. 출하 보류 권고 대상 12농가",
    "affectedMembers" : 12,
    "createdAt" : "2026-05-26T14:30:00+09:00",
    "actionUrl" : "/shipping/recommendations?filter=hold"
  } ],
  "page" : 0,
  "size" : 10,
  "totalElements" : 23,
  "totalPages" : 3,
  "hasNext" : true
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data[].id | String | O | 알림 ID |
| data[].level | String | O | 위험도 (HIGH, MEDIUM, LOW) |
| data[].type | String | O | 알림 타입 (PRICE_DROP, WEATHER, SUPPLY_SHOCK, SHIPPING_WINDOW) |
| data[].title | String | O | 알림 제목 |
| data[].message | String | O | 알림 내용 |
| data[].affectedMembers | Number | O | 영향받는 조합원 수 |
| data[].createdAt | String | O | 생성 시간 |
| data[].actionUrl | String | X | 액션 URL |

### 알림 해제

### Request

```json
PATCH /api/v1/dashboard/alerts/alt_2a91 HTTP/1.1
Content-Type: application/json

{
  "status" : "DISMISSED"
}
```

### Response

```json
HTTP/1.1 204 No Content
```

---

## 조합원 API

### 조합원 랭킹 조회

### Request

```json
GET /api/v1/members/ranking?unionId=uni_001&period=2026-05&group=ALL&page=0&size=20 HTTP/1.1
Host: api.farmu.kr
```

| Name | Required | Description |
| --- | --- | --- |
| unionId | O | 조합 ID |
| period | O | 조회 기간 (yyyy-MM) |
| group | X | 그룹 (ALL, TOP, MIDDLE, NEEDS_IMPROVEMENT) |
| page | X | 페이지 번호 |
| size | X | 페이지 크기 |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : [ {
    "memberId" : "mem_001",
    "rank" : 1,
    "name" : "김상위",
    "group" : "TOP",
    "score" : 92.4,
    "scoreDelta" : 1.2,
    "components" : {
      "production" : 33.1,
      "shipping" : 31.8,
      "revenue" : 27.5
    },
    "mainCrop" : "한우",
    "region" : "경상북도 군위군"
  } ],
  "page" : 0,
  "size" : 20,
  "totalElements" : 142,
  "totalPages" : 8,
  "hasNext" : true
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data[].memberId | String | O | 조합원 ID |
| data[].rank | Number | O | 순위 |
| data[].name | String | O | 이름 |
| data[].group | String | O | 그룹 (TOP, MIDDLE, NEEDS_IMPROVEMENT) |
| data[].score | Number | O | 성과율 점수 |
| data[].scoreDelta | Number | O | 전월 대비 변화량 |
| data[].components.production | Number | O | 생산성 점수 |
| data[].components.shipping | Number | O | 출하 점수 |
| data[].components.revenue | Number | O | 수익성 점수 |
| data[].mainCrop | String | O | 주요 작목 |
| data[].region | String | O | 지역 |

### 조합원 상세 분석 (XAI)

> **권한**: 운영 책임자(UNION_ADMIN)는 자기 조합(`X-Union-Id`) 내 임의 조합원 조회 가능. 조합원(MEMBER)은 **본인 memberId만** 조회 가능 — 타인 조회 시 `403 ACCESS_DENIED`.

### Request

```json
GET /api/v1/members/mem_087/analysis?period=2026-05 HTTP/1.1
Host: api.farmu.kr
```

| Name | Required | Description |
| --- | --- | --- |
| memberId | O | 조합원 ID |
| period | △ | 조회 기간 (yyyy-MM). 생략 시 **최신 집계월** 반환 |

### Response

> 운영 책임자(조합원 상세 페이지)와 조합원 본인(내 분석 페이지)이 동일 엔드포인트를 사용합니다.
> 한 화면에 KPI·구성요소·XAI·12개월 추이·작목 적합도·개선 과제를 모두 렌더하므로 아래 필드를 단건 응답으로 내려줍니다.

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "memberId" : "mem_087",
    "name" : "조합원1",
    "period" : "2026-05",
    "availablePeriods" : [ "2026-05", "2026-04", "2026-03" ],
    "crop" : "사과",
    "region" : "안성",
    "years" : 7,
    "totalScore" : 61.2,
    "scoreDelta" : 3.2,
    "rank" : 42,
    "rankTotal" : 134,
    "group" : "MID",
    "shippingHitRate" : 62,
    "components" : {
      "production" : {
        "value" : 55,
        "score" : 16.5,
        "weight" : 25,
        "percentile" : 28
      },
      "shipping" : {
        "value" : 62,
        "score" : 15.5,
        "weight" : 25,
        "percentile" : 35
      },
      "revenue" : {
        "value" : 57,
        "score" : 11.4,
        "weight" : 20,
        "percentile" : 42
      },
      "quality" : {
        "value" : 60,
        "score" : 9.0,
        "weight" : 15,
        "percentile" : 40
      },
      "costEfficiency" : {
        "value" : 53,
        "score" : 8.8,
        "weight" : 15,
        "percentile" : 33
      }
    },
    "scoreHistory" : [
      { "period" : "2025-06", "score" : 56.0 },
      { "period" : "2025-07", "score" : 57.3 },
      { "period" : "2026-05", "score" : 61.2 }
    ],
    "cropSuitability" : [
      { "crop" : "사과", "fitScore" : 61, "current" : true },
      { "crop" : "배", "fitScore" : 58, "current" : false },
      { "crop" : "포도", "fitScore" : 52, "current" : false }
    ],
    "baseline" : 70.0,
    "xaiFactors" : [ {
      "factor" : "출하시점지연",
      "contribution" : -8.4,
      "direction" : "negative",
      "description" : "권고 출하일보다 평균 14일 지연"
    } ],
    "improvementTasks" : [ {
      "taskId" : "tsk_01",
      "priority" : 1,
      "title" : "출하 시점 14일 단축",
      "category" : "SHIPPING",
      "description" : "출하 점수 62점 — 적기 출하 코칭 필요",
      "expectedImpact" : {
        "scoreDelta" : 6.5,
        "revenueDelta" : 1800000
      }
    } ]
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.memberId | String | O | 조합원 ID |
| data.name | String | O | 조합원 이름 (상세 페이지 헤더) |
| data.period | String | O | 조회 기간 |
| data.availablePeriods | Array | O | 선택 가능한 집계월 목록 (최신순) — 기간 드롭다운용 |
| data.crop | String | O | 주작목 |
| data.region | String | O | 지역 |
| data.years | Number | O | 영농 연차 |
| data.totalScore | Number | O | 총 성과율 (0~100) |
| data.scoreDelta | Number | O | 전월 대비 변화(%p) |
| data.rank | Number | O | 조합 내 순위 |
| data.rankTotal | Number | O | 조합 전체 조합원 수 |
| data.group | String | O | 성과 그룹 (TOP, MID, LOW) |
| data.shippingHitRate | Number | O | 출하 적중률 (%, 0~100). 출하 구성요소와 **별개 지표** — 권고 출하일 대비 적기 출하 비율 |
| data.shippingHitRateDelta | Number | △ | **(B-19 요청) 출하 적중률 전월 대비 증감**(±%p). `scoreDelta`와 동일 패턴. 화면 출하 적중률 KPI를 `▲/▼ vs 전월`로 표기하는 데 사용. 미제공 시 프론트는 `components.shipping.percentile`로 "조합 내 상위 X%" 대체 표기 |
| data.components | Object | O | 구성요소 5종 (production, shipping, revenue, quality, costEfficiency). weight 합 = 100 |
| data.components.{key}.value | Number | O | 구성요소 원점수 (%, 0~100, **막대 표시값**) |
| data.components.{key}.score | Number | O | 가중 반영 점수 (`value × weight / 100`). **Σ score = totalScore** 보장 |
| data.components.{key}.weight | Number | O | 가중치 (합 = 100) |
| data.components.{key}.percentile | Number | O | 조합 내 백분위 |
| data.scoreHistory[] | Array | O | 성과율 추이 (오름차순, 최대 12개월). 데이터 부족 시 **있는 만큼만** |
| data.scoreHistory[].period | String | O | 기간 (yyyy-MM) |
| data.scoreHistory[].score | Number | O | 해당 월 총 성과율 |
| data.cropSuitability[] | Array | O | 작목 적합도 (현재 작목 + 대안 최대 3종, fitScore 내림차순). 공공 토양·기상 데이터 기반 |
| data.cropSuitability[].crop | String | O | 작목명 |
| data.cropSuitability[].fitScore | Number | O | 적합도 (%, 0~100) |
| data.cropSuitability[].current | Boolean | O | 현재 재배 작목 여부 |
| data.baseline | Number | O | XAI 기준선 (조합 평균 또는 고정값). **baseline + Σ xaiFactors[].contribution = totalScore** 보장 |
| data.xaiFactors[].factor | String | O | 요인명 |
| data.xaiFactors[].contribution | Number | O | 기여도(점, 부호 있음) |
| data.xaiFactors[].direction | String | O | 방향 (positive, negative) |
| data.xaiFactors[].description | String | O | 설명 |
| data.improvementTasks[].taskId | String | O | 과제 ID |
| data.improvementTasks[].priority | Number | O | 우선순위 |
| data.improvementTasks[].title | String | O | 과제 제목 |
| data.improvementTasks[].category | String | O | 공통 카테고리 enum (PRODUCTION, SHIPPING, REVENUE, QUALITY, COST, CROP_CHANGE, CONNECT) |
| data.improvementTasks[].description | String | O | 과제 설명 |
| data.improvementTasks[].expectedImpact.scoreDelta | Number | O | 예상 성과율 변화(%p) |
| data.improvementTasks[].expectedImpact.revenueDelta | Number | O | 예상 수익 변화(원) |

---

## 출하 추천 API

### 출하 추천 목록 조회

### Request

```json
GET /api/v1/shipping/recommendations?unionId=uni_001&memberId=mem_087&status=PENDING HTTP/1.1
Host: api.farmu.kr
```

| Name | Required | Description |
| --- | --- | --- |
| unionId | X | 조합 ID |
| memberId | X | 조합원 ID |
| status | X | 상태 (PENDING, ACCEPTED, REJECTED) |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : [ {
    "id" : "shp_a1b2",
    "memberId" : "mem_087",
    "livestockId" : "lvs_2025_0042",
    "currentWeight" : 685.2,
    "targetWeight" : 720,
    "recommendedDate" : "2026-06-12",
    "recommendedAction" : "SHIP",
    "confidence" : 0.87,
    "expectedRevenue" : {
      "min" : 8200000,
      "expected" : 8950000,
      "max" : 9700000
    },
    "riskFactors" : [ {
      "type" : "PRICE_VOLATILITY",
      "score" : 0.32,
      "note" : "다음주 시세 변동성 중간"
    } ],
    "rationale" : "성장곡선 둔화 + 시세 피크 예측 구간",
    "status" : "PENDING",
    "decidedAt" : null
  } ]
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data[].id | String | O | 추천 ID |
| data[].memberId | String | O | 조합원 ID |
| data[].livestockId | String | O | 가축 ID |
| data[].currentWeight | Number | O | 현재 체중(kg) |
| data[].targetWeight | Number | O | 목표 체중(kg) |
| data[].recommendedDate | String | O | 권고 출하일 |
| data[].recommendedAction | String | O | 권고 (SHIP, HOLD, SPLIT_SHIP, REVIEW) |
| data[].confidence | Number | O | 신뢰도 (0~1, 모델 확률값) |
| data[].status | String | O | **결정 상태 (PENDING, ACCEPTED, REJECTED) — B-14 요청.** 프론트는 PENDING일 때만 채택/거절 버튼 노출, 그 외엔 결정 배지 표시 |
| data[].decidedAt | String | X | 결정 시각 (ACCEPTED/REJECTED 시, ISO-8601) |
| data[].expectedRevenue.min | Number | O | 최소 예상 수익 |
| data[].expectedRevenue.expected | Number | O | 기대 수익 |
| data[].expectedRevenue.max | Number | O | 최대 예상 수익 |
| data[].riskFactors[].type | String | O | 위험 타입 |
| data[].riskFactors[].score | Number | O | 위험 점수 |
| data[].rationale | String | O | 추천 근거 |

### 출하 추천 결정 제출

### Request

```json
POST /api/v1/shipping/recommendations/shp_a1b2/decision HTTP/1.1
Content-Type: application/json

{
  "decision" : "ACCEPTED",
  "actualShipDate" : "2026-06-12",
  "memo" : "권고일에 출하"
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| decision | String | O | 결정 (ACCEPTED, REJECTED) |
| actualShipDate | String | X | 실제 출하일 (ACCEPTED 시) |
| memo | String | X | 메모 |

### Response

```json
HTTP/1.1 204 No Content
```

### 출하 적중률 이력 조회

### Request

```json
GET /api/v1/shipping/accuracy?unionId=uni_001&from=2026-01&to=2026-05 HTTP/1.1
Host: api.farmu.kr
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "overallHitRate" : 84,
    "monthly" : [ {
      "period" : "2026-05",
      "totalRecommendations" : 38,
      "accepted" : 32,
      "hitRate" : 87
    } ]
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.overallHitRate | Number | O | 전체 적중률 (%, 0~100) |
| data.monthly[].period | String | O | 월 |
| data.monthly[].totalRecommendations | Number | O | 총 추천 건수 |
| data.monthly[].accepted | Number | O | 채택 건수 |
| data.monthly[].hitRate | Number | O | 월별 적중률 (%, 0~100) |

---


### 출하 추천 생성 (신규 요청)

> **[추가 요청]** 조합원이 경축 데이터를 등록하면 AI가 출하 추천을 자동 생성하는 파이프라인이 필요합니다.
> 현재 `POST /shipping/recommendations` 엔드포인트가 없어 추천 생성 자체가 불가능한 상태입니다.

#### 방식 A — 조합원 경축 데이터 등록 + AI 자동 추천 생성 (권장)

**Step 1. 조합원이 경축 데이터 등록**

```json
POST /api/v1/livestock HTTP/1.1
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "memberId"      : "mem_demo01",
  "tag"           : "cow_001",
  "birthDate"     : "2024-09-01",
  "currentWeight" : 620,
  "targetWeight"  : 680,
  "breed"         : "한우",
  "memo"          : "장마 전 출하 고려 중"
}
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| memberId | String | O | 조합원 ID |
| tag | String | O | 개체 식별 번호 |
| currentWeight | Number | O | 현재 체중 (kg) |
| targetWeight | Number | X | 목표 출하 체중 (kg) |
| breed | String | X | 품종 |
| birthDate | String | X | 출생일 (yyyy-MM-dd) |

**Step 2. 백엔드 AI가 분석 후 출하 추천 자동 생성**

- 등록된 경축 데이터 + 현재 시세 + 기상 정보 기반으로 AI가 추천 생성
- 생성된 추천은 기존 `GET /shipping/recommendations`에서 조회됨
- 운영 책임자가 `POST /shipping/recommendations/{id}/decision`으로 채택/거절

#### 방식 B — SUPER_ADMIN/UNION_ADMIN이 직접 추천 등록 (대안)

```json
POST /api/v1/shipping/recommendations HTTP/1.1
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "memberId"          : "mem_demo01",
  "livestockId"       : "cow_001",
  "currentWeight"     : 620,
  "recommendedAction" : "SHIP",
  "recommendedDate"   : "2026-06-28",
  "confidence"        : 0.87,
  "expectedRevenue"   : { "min": 2800000, "expected": 3200000, "max": 3600000 },
  "riskFactors"       : [{ "type": "WEATHER", "note": "장마 전 출하 권고" }],
  "rationale"         : "현재 체중·시세 기준 최적 출하 시점"
}
```

> 방식 A가 구현되기 전 임시 운영 또는 데모 시딩 용도

---

## 필지/적합도 API

### 조합원 필지 목록 조회

### Request

```json
GET /api/v1/lands?memberId=mem_087 HTTP/1.1
Host: api.farmu.kr
```

| Name | Required | Description |
| --- | --- | --- |
| memberId | O | 조합원 ID |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : [ {
    "id" : "lnd_3f01",
    "pnu" : "4772025021100010000",
    "areaM2" : 12450,
    "geometry" : {
      "type" : "Polygon",
      "coordinates" : [ [ [ 128.572, 36.241 ], [ 128.573, 36.241 ], [ 128.573, 36.242 ], [ 128.572, 36.242 ], [ 128.572, 36.241 ] ] ]
    },
    "currentCrop" : "한우 사육",
    "soilType" : "양토",
    "slope" : 4.2,
    "elevation" : 142
  } ]
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data[].id | String | O | 필지 ID |
| data[].pnu | String | O | 필지 고유번호 |
| data[].areaM2 | Number | O | 면적(㎡) |
| data[].geometry | Object | O | GeoJSON Polygon |
| data[].currentCrop | String | O | 현재 작목 |
| data[].soilType | String | O | 토양 유형 |
| data[].slope | Number | O | 경사도(도) |
| data[].elevation | Number | O | 고도(m) |

> ⚠️ **실제 응답과 명세 차이(2026-06-16 실측)**: 위 명세는 `geometry`(GeoJSON Polygon)·`areaM2`·`soilType`·`slope`·`elevation`을 약속하나, 실제 `GET /lands`는 `{landId, memberId, name, pnu, address, latitude, longitude, area(㎡), mainCrop}`만 반환하고 **`geometry`가 없음**. 프론트는 `latitude/longitude`로 **VWorld 연속지적도(WFS)** 를 조회해 필지 폴리곤을 입혀 그림. (백엔드가 `geometry`를 직접 주면 VWorld 의존 제거 가능 — 선택사항)

### 필지 등록 (B-16 — ✅ 구현 완료)

> 2026-06-17 실측: `POST /lands` → **201 {landId}**, `DELETE /lands/{id}` → **204** 동작 확인. 프론트 UI(지도 필지 클릭 → PNU·중심좌표·면적 자동 캡처 + 작목 입력 → 저장 / 상세패널 삭제 버튼) 그대로 연동됨.

### Request

```json
POST /api/v1/lands HTTP/1.1
Host: api.farmu.kr
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name" : "동쪽 사과밭",
  "pnu" : "2714010100102950000",
  "address" : "대구광역시 동구 신암동 295",
  "latitude" : 35.8766,
  "longitude" : 128.6183,
  "area" : 1200,
  "mainCrop" : "사과",
  "memberId" : "mem_demo01"
}
```

| Name | Required | Description |
| --- | --- | --- |
| name | O | 필지 이름 |
| pnu | O | 필지 고유번호(PNU, 19자리) — 지도 클릭 시 VWorld에서 캡처 |
| address | O | 지번/도로명 주소 |
| latitude / longitude | O | 필지 중심 좌표(WGS84) |
| area | O | 면적(㎡) |
| mainCrop | O | 작목(또는 축종) |
| memberId | △ | 운영책임자가 조합원 대신 등록 시. 조합원 본인 등록 시엔 토큰에서 도출(생략 가능) |

### Response

```json
HTTP/1.1 201 Created
Content-Type: application/json

{ "data" : { "landId" : "lnd_a1b2" } }
```

### 필지 삭제

```json
DELETE /api/v1/lands/{landId} HTTP/1.1
Authorization: Bearer {accessToken}
```

| 응답 | 설명 |
| --- | --- |
| 200 / 204 | 삭제 성공 |
| 403 | 본인(또는 같은 조합) 필지가 아님 |
| 404 | `LAND_NOT_FOUND` |

### 필지별 작목 적합도 조회

### Request

```json
GET /api/v1/lands/lnd_3f01/suitability HTTP/1.1
Host: api.farmu.kr
```

| Name | Required | Description |
| --- | --- | --- |
| landId | O | 필지 ID |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "landId" : "lnd_3f01",
    "currentCropScore" : 72,
    "candidates" : [ {
      "cropCode" : "C0102",
      "cropName" : "사과(후지)",
      "suitabilityScore" : 88,
      "rank" : 1,
      "factors" : {
        "soil" : 92,
        "climate" : 85,
        "slope" : 88,
        "sunlight" : 90
      },
      "riskFactors" : [ {
        "type" : "FROST",
        "level" : "MEDIUM",
        "note" : "4월 만상 위험"
      } ],
      "expectedRevenuePerHa" : 28500000
    } ]
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.landId | String | O | 필지 ID |
| data.currentCropScore | Number | O | 현재 작목 적합도 |
| data.candidates[].cropCode | String | O | 작목 코드 |
| data.candidates[].cropName | String | O | 작목명 |
| data.candidates[].suitabilityScore | Number | O | 적합도 점수 (0~100) |
| data.candidates[].rank | Number | O | 순위 |
| data.candidates[].factors.soil | Number | O | 토양 적합도 (%, 0~100) |
| data.candidates[].factors.climate | Number | O | 기후 적합도 (%, 0~100) |
| data.candidates[].factors.slope | Number | O | 경사 적합도 (%, 0~100) |
| data.candidates[].factors.sunlight | Number | O | 일조 적합도 (%, 0~100) |
| data.candidates[].riskFactors[].type | String | O | 위험 타입 (FROST, DROUGHT, PEST 등) |
| data.candidates[].riskFactors[].level | String | O | 위험도 (LOW, MEDIUM, HIGH) |
| data.candidates[].expectedRevenuePerHa | Number | O | 헥타르당 예상 수익(원) |

---

## 시나리오 API

### 시나리오 시뮬레이션

### Request

```json
POST /api/v1/scenarios/simulate HTTP/1.1
Content-Type: application/json

{
  "memberId" : "mem_087",
  "landId" : "lnd_3f01",
  "changes" : {
    "fromCrop" : "한우",
    "toCrop" : "C0102",
    "applyAreaRatio" : 0.5,
    "startPeriod" : "2026-09"
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| memberId | String | O | 조합원 ID |
| landId | String | O | 필지 ID |
| changes.fromCrop | String | O | 기존 작목 |
| changes.toCrop | String | O | 변경 작목 코드 |
| changes.applyAreaRatio | Number | O | 적용 면적 비율 (0~1, 입력 비율 — 0.5 = 면적의 50%) |
| changes.startPeriod | String | O | 시작 시점 (yyyy-MM) |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "scenarioId" : "scn_9c2d",
    "baseline" : {
      "score" : 61.2,
      "annualRevenue" : 145000000
    },
    "projected" : {
      "score" : 71.5,
      "annualRevenue" : 168000000
    },
    "delta" : {
      "scorePoint" : 10.3,
      "revenue" : 23000000,
      "revenuePct" : 15.9
    },
    "timeline" : [ {
      "period" : "2026-Q4",
      "score" : 62.0,
      "revenue" : 8000000
    } ],
    "risks" : [ {
      "type" : "INITIAL_INVESTMENT",
      "amount" : 45000000,
      "note" : "묘목·시설 초기 투자"
    } ],
    "confidence" : 0.74
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.scenarioId | String | O | 시나리오 ID |
| data.baseline.score | Number | O | 현재 성과율 |
| data.baseline.annualRevenue | Number | O | 현재 연 수익 |
| data.projected.score | Number | O | 예상 성과율 |
| data.projected.annualRevenue | Number | O | 예상 연 수익 |
| data.delta.scorePoint | Number | O | 성과율 변화(%p) |
| data.delta.revenue | Number | O | 수익 변화(원) |
| data.delta.revenuePct | Number | O | 수익 변화율 (%, 0~100) |
| data.confidence | Number | O | 예측 신뢰도 (0~1, 모델 확률값) |

### 시나리오 저장

### Request

```json
POST /api/v1/scenarios HTTP/1.1
Content-Type: application/json

{
  "scenarioId" : "scn_9c2d",
  "name" : "사과 전환 50% 시나리오"
}
```

### Response

```json
HTTP/1.1 201 Created
```

### 시나리오 목록 조회

### Request

```json
GET /api/v1/scenarios?memberId=mem_087 HTTP/1.1
Host: api.farmu.kr
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : [ {
    "id" : "scn_9c2d",
    "name" : "사과 전환 50% 시나리오",
    "createdAt" : "2026-05-20T10:00:00+09:00"
  } ]
}
```

### 시나리오 삭제

### Request

```json
DELETE /api/v1/scenarios/scn_9c2d HTTP/1.1
Host: api.farmu.kr
```

### Response

```json
HTTP/1.1 204 No Content
```

### 시나리오 조합원 제안 (B-17 요청 — 미구현)

> 운영책임자가 "조합원에게 제안 보내기"를 누르면, 그 시나리오를 **대상 조합원에게 제안**으로 보내고(상태/알림 포함) 조합원이 본인 화면에서 확인하는 흐름. 현재 전용 엔드포인트 없음(2026-06-18 실측: `POST /scenarios/{id}/propose`→404, `POST /scenarios/propose`→405). 프론트는 **임시로 `POST /scenarios`(저장)** 로 대체해 조합원 목록에 노출 중(실측: 조합원이 `[제안]` 시나리오 확인됨) — 단 "제안됨" 상태·알림 구분이 없음.

### Request

```json
POST /api/v1/scenarios/{scenarioId}/propose HTTP/1.1
Authorization: Bearer {accessToken}
Content-Type: application/json

{ "memberId": "mem_demo01", "message": "배 전환을 검토해보세요 (선택)" }
```

| Name | Required | Description |
| --- | --- | --- |
| scenarioId | O | 제안할 시나리오 ID (시뮬레이션·저장으로 생성된 것) |
| memberId | O | 제안 대상 조합원 |
| message | X | 운영책임자 코멘트 |

### Response

```json
HTTP/1.1 200 OK
{ "data": { "scenarioId": "scn_9c2d", "status": "PROPOSED", "proposedAt": "2026-06-18T10:00:00+09:00" } }
```

- 권장: 시나리오/목록 응답에 `status`(DRAFT/SAVED/**PROPOSED**), `proposedBy`, `proposedAt` 추가 → 조합원 화면에서 "운영책임자 제안"으로 구분 표시.
- 조합원 알림(`dashboard/alerts` 또는 별도 알림)에 "새 개선 제안 도착" 연동 시 더 완결적.

---

## 멘토링 API

### 멘토 매칭 후보 조회

### Request

```json
GET /api/v1/mentoring/suggestions?menteeId=mem_087 HTTP/1.1
Host: api.farmu.kr
```

| Name | Required | Description |
| --- | --- | --- |
| menteeId | O | 멘티 조합원 ID |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : [ {
    "mentorId" : "mem_001",
    "name" : "김상위",
    "matchScore" : 91,
    "matchReasons" : [ "동일 작목(한우)", "유사 사육규모", "출하 적중률 상위 5%" ],
    "mentorScore" : 92.4,
    "distanceKm" : 8.2
  } ]
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data[].mentorId | String | O | 멘토 ID |
| data[].name | String | O | 멘토 이름 |
| data[].matchScore | Number | O | 매칭 점수 (%, 0~100) — 카드에 크게 표시 |
| data[].matchReasons | Array | O | 매칭 근거 |
| data[].mentorScore | Number | O | 멘토 본인 성과율 (0~100) |
| data[].distanceKm | Number | O | 거리(km) |

### 매칭 상세 조회

추천 매칭 카드의 "상세"를 눌렀을 때 진입하는 **매칭 상세 페이지**용. 멘토 프로필, 요인별 적합도, 멘티-멘토 성과 비교, 멘토가 도울 수 있는 영역을 한 번에 내려줍니다.

### Request

```json
GET /api/v1/mentoring/suggestions/mem_001?menteeId=mem_087 HTTP/1.1
Host: api.farmu.kr
```

| Name | Required | Description |
| --- | --- | --- |
| mentorId | O | 멘토 조합원 ID (path) |
| menteeId | O | 멘티 조합원 ID (query) — 비교·근거 산출 기준 |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "mentorId" : "mem_001",
    "name" : "박○○ 조합원",
    "crop" : "사과",
    "years" : 12,
    "region" : "안성",
    "distanceKm" : 4.2,
    "mentorScore" : 94.1,
    "matchScore" : 92,
    "reason" : "동일 작목·유사 토양 환경에서 상위 성과를 유지하며 출하 적기 노하우가 풍부합니다.",
    "tags" : [ "출하 전문", "동일 작목", "근거리" ],
    "matchFactors" : [
      { "factor" : "작목 일치", "score" : 98 },
      { "factor" : "토양 유사도", "score" : 91 },
      { "factor" : "거리 근접", "score" : 88 },
      { "factor" : "출하 노하우", "score" : 95 },
      { "factor" : "경험 연차", "score" : 92 }
    ],
    "comparison" : [
      { "category" : "생산성", "menteeScore" : 55, "mentorScore" : 95 },
      { "category" : "출하", "menteeScore" : 62, "mentorScore" : 92 },
      { "category" : "수익성", "menteeScore" : 57, "mentorScore" : 95 }
    ],
    "helpAreas" : [ {
      "category" : "SHIPPING",
      "title" : "출하 적기 코칭",
      "description" : "12년 출하 데이터 기반 적기 판단 노하우 전수"
    } ]
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.mentorId | String | O | 멘토 ID |
| data.name | String | O | 멘토 이름 |
| data.crop | String | O | 멘토 주작목 |
| data.years | Number | O | 영농 연차 |
| data.region | String | O | 지역 |
| data.distanceKm | Number | O | 멘티와의 거리(km) |
| data.mentorScore | Number | O | 멘토 성과율 (0~100) |
| data.matchScore | Number | O | 매칭 점수 (%, 0~100) — 후보 조회 `matchScore`와 동일 체계 |
| data.reason | String | O | 추천 사유 (서술형) |
| data.tags | Array | O | 매칭 특성 태그 |
| data.matchFactors[] | Array | O | 요인별 적합도 (막대 표시) |
| data.matchFactors[].factor | String | O | 요인명 (작목 일치, 토양 유사도, 거리 근접 등) |
| data.matchFactors[].score | Number | O | 요인 적합도 (0~100) |
| data.comparison[] | Array | O | 멘티 vs 멘토 성과 비교 (그룹 막대) |
| data.comparison[].category | String | O | 비교 항목 (생산성, 출하, 수익성) |
| data.comparison[].menteeScore | Number | O | 멘티 본인 점수 (0~100) |
| data.comparison[].mentorScore | Number | O | 멘토 점수 (0~100) |
| data.helpAreas[] | Array | O | 멘토가 도울 수 있는 영역 |
| data.helpAreas[].category | String | O | 공통 카테고리 enum (PRODUCTION, SHIPPING, REVENUE, QUALITY, COST, CROP_CHANGE, CONNECT) |
| data.helpAreas[].title | String | O | 도움 항목 제목 |
| data.helpAreas[].description | String | O | 도움 항목 설명 |

### 매칭 요청

### Request

```json
POST /api/v1/mentoring/matches HTTP/1.1
Content-Type: application/json

{
  "mentorId" : "mem_001",
  "menteeId" : "mem_087",
  "goal" : "출하시점 최적화"
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| mentorId | String | O | 멘토 ID |
| menteeId | String | O | 멘티 ID |
| goal | String | O | 매칭 목표 |

### Response

```json
HTTP/1.1 201 Created
Content-Type: application/json

{
  "data" : {
    "matchId" : "mtc_4a2f",
    "status" : "REQUESTED"
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.matchId | String | O | 매칭 ID |
| data.status | String | O | 상태 (REQUESTED, APPROVED, IN_PROGRESS, COMPLETED, REJECTED) |

### 매칭 승인 (운영 책임자)

### Request

```json
PATCH /api/v1/mentoring/matches/mtc_4a2f/approve HTTP/1.1
Host: api.farmu.kr
```

### Response

```json
HTTP/1.1 204 No Content
```

### 매칭 거절

### Request

```json
PATCH /api/v1/mentoring/matches/mtc_4a2f/reject HTTP/1.1
Content-Type: application/json

{
  "reason" : "멘토 일정 불가"
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| reason | String | O | 거절 사유 |

### Response

```json
HTTP/1.1 204 No Content
```

### 공동 실행 과제 목록

### Request

```json
GET /api/v1/mentoring/matches/mtc_4a2f/tasks HTTP/1.1
Host: api.farmu.kr
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : [ {
    "id" : "tsk_01",
    "title" : "출하 시점 컨설팅 1회차",
    "status" : "DOING",
    "dueDate" : "2026-06-15",
    "createdAt" : "2026-05-20T10:00:00+09:00"
  } ]
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data[].id | String | O | 과제 ID |
| data[].title | String | O | 과제 제목 |
| data[].status | String | O | 상태 (TODO, DOING, DONE) |
| data[].dueDate | String | X | 마감일 |
| data[].createdAt | String | O | 생성일 |

### 과제 생성

### Request

```json
POST /api/v1/mentoring/matches/mtc_4a2f/tasks HTTP/1.1
Content-Type: application/json

{
  "title" : "출하 시점 컨설팅 1회차",
  "dueDate" : "2026-06-15"
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| title | String | O | 과제 제목 |
| dueDate | String | X | 마감일 |

### Response

```json
HTTP/1.1 201 Created
```

### 과제 상태 변경

### Request

```json
PATCH /api/v1/mentoring/matches/mtc_4a2f/tasks/tsk_01 HTTP/1.1
Content-Type: application/json

{
  "status" : "DONE"
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| status | String | O | 상태 (TODO, DOING, DONE) |

### Response

```json
HTTP/1.1 204 No Content
```

---

## 리포트 API

### 리포트 생성 요청

### Request

```json
POST /api/v1/reports/generate HTTP/1.1
Content-Type: application/json

{
  "type" : "UNION_MONTHLY",
  "unionId" : "uni_001",
  "period" : "2026-05",
  "format" : "PDF",
  "sections" : [ "summary", "ranking", "alerts", "actions" ]
}
```

> ⚠️ **명세-구현 불일치(2026-06-17 실측)**: `type` 실제 허용값은 **`UNION` | `MONTHLY` | `MEMBER`** (아래 표의 `UNION_MONTHLY`/`MEMBER_ACTION`은 구버전). 구버전 값 전송 시 `400 INVALID_REQUEST: "type: Input should be 'MEMBER', 'UNION' or 'MONTHLY'"`. 또 생성 완료 상태는 `COMPLETED`가 아니라 **`READY`**, 생성 응답 식별자는 `reportId`가 아니라 **`jobId`**. → 프론트 정정 반영 완료(`UNION`/`MONTHLY`/`MEMBER`, `READY`→완료). **백엔드: 명세서 enum/상태값을 구현과 일치시켜 주세요.**

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| type | String | O | 리포트 유형 — **실제: `UNION` \| `MONTHLY` \| `MEMBER`** (명세 구버전: UNION_MONTHLY/MEMBER_ACTION) |
| unionId | String | △ | 조합 ID (UNION/MONTHLY 시 필수) |
| memberId | String | △ | 조합원 ID (MEMBER 시 필수) |
| period | String | O | 기간 (yyyy-MM) |
| format | String | O | 형식 (PDF, XLSX) |
| sections | Array | X | 포함 섹션 목록 |

### Response

```json
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "data" : {
    "reportId" : "rpt_5e8f",
    "status" : "PROCESSING",
    "estimatedSeconds" : 45
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.reportId | String | O | 리포트 ID |
| data.status | String | O | 상태 (PROCESSING, COMPLETED, FAILED) |
| data.estimatedSeconds | Number | O | 예상 소요 시간(초) |

### 리포트 상태 조회

### Request

```json
GET /api/v1/reports/rpt_5e8f HTTP/1.1
Host: api.farmu.kr
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "id" : "rpt_5e8f",
    "type" : "UNION_MONTHLY",
    "status" : "COMPLETED",
    "format" : "PDF",
    "downloadUrl" : "https://cdn.farmu.kr/reports/rpt_5e8f.pdf?sig=...",
    "expiresAt" : "2026-05-28T10:00:00+09:00",
    "fileSize" : 2458672,
    "createdAt" : "2026-05-27T10:00:00+09:00"
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.id | String | O | 리포트 ID |
| data.type | String | O | 리포트 유형 |
| data.status | String | O | 상태 (PROCESSING, COMPLETED, FAILED) |
| data.format | String | O | 형식 |
| data.downloadUrl | String | X | 다운로드 URL (COMPLETED 시) |
| data.expiresAt | String | X | URL 만료 시간 |
| data.fileSize | Number | X | 파일 크기(byte) |
| data.createdAt | String | O | 생성 시간 |

### 리포트 이력 조회

### Request

```json
GET /api/v1/reports?unionId=uni_001&type=UNION_MONTHLY&page=0&size=20 HTTP/1.1
Host: api.farmu.kr
```

| Name | Required | Description |
| --- | --- | --- |
| unionId | X | 조합 ID |
| type | X | 리포트 유형 |
| page | X | 페이지 번호 |
| size | X | 페이지 크기 |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : [ {
    "id" : "rpt_5e8f",
    "type" : "UNION_MONTHLY",
    "period" : "2026-05",
    "format" : "PDF",
    "status" : "COMPLETED",
    "createdAt" : "2026-05-27T10:00:00+09:00"
  } ],
  "page" : 0,
  "size" : 20,
  "totalElements" : 12,
  "totalPages" : 1,
  "hasNext" : false
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data[].id | String | O | 리포트 ID |
| data[].type | String | O | 리포트 유형 |
| data[].period | String | O | 대상 기간 |
| data[].format | String | O | 파일 형식 |
| data[].status | String | O | 상태 |
| data[].createdAt | String | O | 생성 시간 |

> ⚠️ **B-18 역할 스코프 (보안, 2026-06-18 실측)**: 현재 **멤버 토큰으로도 조합 전체 리포트가 그대로 반환**되어, 다른 조합원의 개인 리포트(`type: MEMBER`, 남의 `memberId`)까지 노출됨. 실측: `mem_demo01` 로그인 목록에 `mem_demo02`의 MEMBER 리포트 포함.
>
> **요청 — 토큰 역할 기반 스코프:**
> - **운영책임자(UNION_ADMIN)**: 조합 전체 (지금과 동일)
> - **조합원(MEMBER)**: **조합 공통(`UNION`/`MONTHLY`) + 본인(`memberId` == 토큰 사용자)의 `MEMBER` 리포트만**. 타 조합원 `MEMBER` 리포트 제외.
>
> 응답 항목에 `memberId`(MEMBER 리포트의 대상 조합원)를 포함하면 프론트/감사에도 유용. **프론트는 임시로 클라이언트 필터링 적용 중**(`isAdmin || type!=='MEMBER' || memberId===내memberId`) — 실측상 타 조합원 리포트 차단되나, 데이터가 멤버에게 내려오는 것 자체는 백엔드에서 막는 게 맞음.

---

## 데이터 업로드 API

### 업로드 URL 발급

### Request

```json
POST /api/v1/data/uploads HTTP/1.1
Content-Type: application/json

{
  "fileName" : "members_202605.xlsx",
  "dataType" : "MEMBER_PERFORMANCE",
  "size" : 1248576
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| fileName | String | O | 파일명 |
| dataType | String | O | 데이터 유형 (MEMBER_PERFORMANCE, SHIPPING_HISTORY, LIVESTOCK, SALES, LAND) |
| size | Number | O | 파일 크기(byte) |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "uploadId" : "upl_7a3c",
    "uploadUrl" : "https://s3.ap-northeast-2.amazonaws.com/farmu-uploads/...",
    "expiresIn" : 600
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.uploadId | String | O | 업로드 ID |
| data.uploadUrl | String | O | Pre-signed PUT URL |
| data.expiresIn | Number | O | URL 만료 시간(초) |

### 업로드 완료 알림 (검증 시작)

### Request

```json
POST /api/v1/data/uploads/upl_7a3c/commit HTTP/1.1
Host: api.farmu.kr
```

### Response

```json
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "data" : {
    "uploadId" : "upl_7a3c",
    "status" : "VALIDATING"
  }
}
```

### 검증 결과 조회

### Request

```json
GET /api/v1/data/uploads/upl_7a3c/validation HTTP/1.1
Host: api.farmu.kr
```

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : {
    "uploadId" : "upl_7a3c",
    "status" : "VALIDATED_WITH_ERRORS",
    "summary" : {
      "totalRows" : 142,
      "validRows" : 138,
      "errorRows" : 4,
      "warningRows" : 7
    },
    "errors" : [ {
      "row" : 23,
      "column" : "출하일",
      "value" : "2026-13-01",
      "code" : "INVALID_DATE",
      "message" : "유효하지 않은 날짜 형식"
    } ],
    "warnings" : [ {
      "row" : 45,
      "column" : "체중",
      "value" : 1250,
      "code" : "OUTLIER",
      "message" : "평균 대비 +3σ 초과"
    } ]
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.uploadId | String | O | 업로드 ID |
| data.status | String | O | 상태 (VALIDATING, VALIDATED, VALIDATED_WITH_ERRORS, FAILED) |
| data.summary.totalRows | Number | O | 전체 행 수 |
| data.summary.validRows | Number | O | 유효 행 수 |
| data.summary.errorRows | Number | O | 오류 행 수 |
| data.summary.warningRows | Number | O | 경고 행 수 |
| data.errors[].row | Number | O | 행 번호 |
| data.errors[].column | String | O | 컬럼명 |
| data.errors[].value | String | O | 입력 값 |
| data.errors[].code | String | O | 오류 코드 |
| data.errors[].message | String | O | 오류 메시지 |

### 오류 행 수정

### Request

```json
PATCH /api/v1/data/uploads/upl_7a3c/rows/23 HTTP/1.1
Content-Type: application/json

{
  "column" : "출하일",
  "value" : "2026-03-01"
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| column | String | O | 수정할 컬럼명 |
| value | String | O | 수정 값 |

### Response

```json
HTTP/1.1 204 No Content
```

### 재검증

### Request

```json
POST /api/v1/data/uploads/upl_7a3c/revalidate HTTP/1.1
Host: api.farmu.kr
```

### Response

```json
HTTP/1.1 202 Accepted
```

### 최종 반영

### Request

```json
POST /api/v1/data/uploads/upl_7a3c/apply HTTP/1.1
Content-Type: application/json

{
  "skipErrors" : false,
  "applyWarnings" : true
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| skipErrors | Boolean | O | 오류 행 건너뛰기 여부 |
| applyWarnings | Boolean | O | 경고 행 포함 여부 |

### Response

```json
HTTP/1.1 204 No Content
```

### 업로드 이력 조회

### Request

```json
GET /api/v1/data/uploads?unionId=uni_001&dataType=MEMBER_PERFORMANCE&status=APPLIED&page=0&size=20 HTTP/1.1
Host: api.farmu.kr
```

| Name | Required | Description |
| --- | --- | --- |
| unionId | X | 조합 ID |
| dataType | X | 데이터 유형 |
| status | X | 상태 (PENDING, VALIDATING, VALIDATED, APPLIED, FAILED) |
| page | X | 페이지 번호 |
| size | X | 페이지 크기 |

### Response

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data" : [ {
    "id" : "upl_7a3c",
    "fileName" : "members_202605.xlsx",
    "dataType" : "MEMBER_PERFORMANCE",
    "status" : "APPLIED",
    "uploadedBy" : "usr_8f3a",
    "createdAt" : "2026-05-27T10:00:00+09:00"
  } ],
  "page" : 0,
  "size" : 20,
  "totalElements" : 8,
  "totalPages" : 1,
  "hasNext" : false
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data[].id | String | O | 업로드 ID |
| data[].fileName | String | O | 파일명 |
| data[].dataType | String | O | 데이터 유형 |
| data[].status | String | O | 상태 |
| data[].uploadedBy | String | O | 업로더 ID |
| data[].createdAt | String | O | 업로드 시간 |

---

### AI 성과 초안 생성 (신규 — B-21)

> **UNION_ADMIN 전용**. 조합원별 필지 데이터 + 공공데이터(기상청·흙토람·농업통계)를 기반으로 AI가 해당 월의 **조합원 성과 초안(MEMBER_PERFORMANCE)**을 자동 생성합니다.
> 운영 책임자가 초안을 검토·수정 후 `apply`로 최종 반영합니다. 수동 CSV 업로드 대비 데이터 수집 부담을 제거하는 것이 목적입니다.

#### Request

```json
POST /api/v1/data/ai-draft HTTP/1.1
Content-Type: application/json

{
  "dataType" : "MEMBER_PERFORMANCE",
  "period"   : "2026-05"
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| dataType | String | O | 생성할 데이터 유형. 현재는 `MEMBER_PERFORMANCE` 지원 |
| period | String | X | 생성 대상 월 (`yyyy-MM`). 생략 시 직전 완료 월 |

#### Response

```json
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "data" : {
    "uploadId" : "upl_ai_9f2d",
    "status"   : "DRAFT",
    "period"   : "2026-05",
    "rowCount" : 2,
    "rows"     : [
      {
        "rowId"        : 1,
        "memberId"     : "mem_demo01",
        "name"         : "김민수",
        "production"   : 82,
        "shipping"     : 75,
        "revenue"      : 78,
        "quality"      : 80,
        "cost"         : 71,
        "aiGenerated"  : true,
        "basis"        : "합천군 사과 지역 평균 수확량(농업통계) + 2026-05 기상 데이터 적용"
      },
      {
        "rowId"        : 2,
        "memberId"     : "mem_demo02",
        "name"         : "이서연",
        "production"   : 68,
        "shipping"     : 72,
        "revenue"      : 65,
        "quality"      : 70,
        "cost"         : 66,
        "aiGenerated"  : true,
        "basis"        : "합천군 복숭아 지역 평균 수확량(농업통계) + 2026-05 기상 데이터 적용"
      }
    ]
  }
}
```

| Path | Type | Required | Description |
| --- | --- | --- | --- |
| data.uploadId | String | O | 업로드 ID (이후 수정·반영에 동일하게 사용) |
| data.status | String | O | `DRAFT` 고정 (관리자 검토 대기 상태) |
| data.period | String | O | 생성 대상 월 |
| data.rowCount | Number | O | 생성된 조합원 수 |
| data.rows[].rowId | Number | O | 행 식별자 (수정 API에 사용) |
| data.rows[].memberId | String | O | 조합원 ID |
| data.rows[].name | String | O | 조합원 이름 |
| data.rows[].production | Number | O | 생산성 점수 (0~100) |
| data.rows[].shipping | Number | O | 출하 점수 (0~100) |
| data.rows[].revenue | Number | O | 수익성 점수 (0~100) |
| data.rows[].quality | Number | O | 품질 점수 (0~100) |
| data.rows[].cost | Number | O | 비용효율 점수 (0~100) |
| data.rows[].aiGenerated | Boolean | O | AI 생성 여부 (`true`) |
| data.rows[].basis | String | O | 산정 근거 (어떤 공공데이터를 사용했는지 한 줄 설명) |

#### AI 산정 기준

백엔드는 아래 3개 공공데이터를 교차 적용해 각 점수를 산정합니다:

| 데이터 | API | 반영 항목 |
| --- | --- | --- |
| 기상청 | 기상청 기상 API | 해당 월 기온·강수량·일조시간 → 작황 보정 |
| 흙토람 | 농촌진흥청 토양환경지도 | 필지 토성·pH → 생산성 보정 |
| 농업통계 | 농업통계포털 시군구 단위 | 작목별 지역 평균 수확량·수익 → 기준값 설정 |

#### DRAFT 초안 행 수정

운영 책임자가 AI 초안의 개별 행 값을 수정합니다. 기존 `PATCH /data/uploads/{uploadId}/rows/{rowId}` 동일 엔드포인트 재사용.

```json
PATCH /api/v1/data/uploads/upl_ai_9f2d/rows/1 HTTP/1.1
Content-Type: application/json

{
  "column" : "production",
  "value"  : "85"
}
```

수정된 행은 `aiGenerated: false`로 전환됩니다 (관리자가 직접 확정한 값임을 표시).

#### DRAFT 최종 반영

검토 완료 후 기존 apply 엔드포인트로 반영합니다.

```json
POST /api/v1/data/uploads/upl_ai_9f2d/apply HTTP/1.1
Content-Type: application/json

{
  "skipErrors"    : false,
  "applyWarnings" : true
}
```

반영 후 `status`는 `APPLIED`로 전환되며 이후 성과 분석·리포트에 반영됩니다.

---

## 부록 — 결정 사항 (Resolved Decisions)

프론트 화면 기준으로 모호했던 지점을 **사용자 친화적·일관성 우선으로 확정**하고 위 본문에 모두 반영했습니다. 각 항목은 `현황 / 모호한 점 / 결정` 순이며, **결정 내용이 본문(특히 Overview의 "공통 규칙")에 적용된 최종값**입니다. 변경을 원하면 해당 항목만 다시 합의하면 됩니다.

> 핵심 결정 요약: ① 모든 비율은 **% 정수(0~100)** ② 식별자 **단일 `memberId`/`mentorId`** ③ 그룹 **`TOP/MID/LOW`** ④ 매칭 점수 **0~100** ⑤ 구성요소 막대=`value`·합산=`score` ⑥ XAI **`baseline + Σ기여도 = 총점` 보장** ⑦ `period` 선택값+`availablePeriods` ⑧ 카테고리 **공통 enum 7종** ⑨ 시계열 **가변 길이** ⑩ 권한 **MEMBER 본인만**.

### 1. 식별자 체계 (memberId / uid / mentorId)

- **현황**: 명세서 예시는 `mem_087` 형식, 프론트 라우트는 `/members/UID-0042`, `/mentoring/park` 형식(목 데이터). API 함수는 `getAnalysis(memberId)`로 path에 그대로 박습니다.
- **모호한 점**: URL/응답에 쓰는 식별자가 **내부 PK(`mem_087`)인지, 외부 노출용 코드(`UID-0042`)인지** 불명확. 둘이 다르면 프론트는 어느 값으로 라우팅·조회해야 하는지 결정 필요.
- **결정**: 모든 API의 path·응답 id는 **외부 노출용 단일 식별자 하나로 통일**(예: `memberId = "mem_087"`). 프론트는 목록 응답에서 받은 `memberId`를 그대로 상세 조회 path에 사용. `UID-0042`·`park` 등은 목 더미이므로 실제 연동 시 폐기. 멘토 id도 동일하게 `mentorId`(=memberId) 사용.

### 2. 매칭 점수 단위·필드 (matchScore vs score)

- **현황**: 후보 조회(`/mentoring/suggestions`)는 `matchScore: 0.91`(0~1)과 `score: 92.4`(멘토 성과율)를 **별도 필드**로 줌. 그런데 프론트 카드는 `score`(92)를 "매칭 점수"로 크게 표시하고 멘토 성과율은 안 보여줌. 매칭 상세는 `matchScore: 92`(0~100)로 적었음.
- **모호한 점**: "매칭 점수"로 화면에 띄우는 값이 `matchScore(0~1)`인지 `score`인지 필드 매핑이 엇갈림. 단위(0~1 vs 0~100)도 엔드포인트마다 다름.
- **결정**: 의미를 분리해 **이름을 명확히** — 매칭 적합도 = `matchScore`(0~100 정수), 멘토 본인 성과율 = `mentorScore`(0~100). 후보 조회도 `matchScore`를 0~100으로 통일하고 `score` → `mentorScore`로 개명. 카드/상세 모두 `matchScore`를 "매칭 점수"로 렌더.

### 3. 구성요소 value vs score (막대가 표시하는 값)

- **현황**: 기존 명세는 `components.production.score = 22.4`(가중 반영 점수). 그러나 프론트 막대(내 분석·조합원 상세)는 **0~100 원점수**(예: 82, 95)를 그림. 그래서 `value`(0~100 원점수) 필드를 추가했음.
- **모호한 점**: 막대 길이를 `value`(0~100)로 그릴지, `score`(가중, 합이 totalScore)로 그릴지. 둘을 혼동하면 막대가 전부 짧게(20점대) 나옴.
- **결정**: **막대 표시 = `value`(0~100), 총점 합산 = `score`(가중)**. 둘 다 응답에 포함(현재 명세대로). `value × weight / 100 = score`, `Σ score = totalScore` 관계를 백엔드가 보장.

### 4. 출하 적중률 (shippingHitRate) 단위·정의

- **현황**: 대시보드 KPI는 `shippingHitRate: 0.84`(0~1), 조합원 분석은 `shippingHitRate: 62`(%). 게다가 분석에서는 출하 component `value`(62)와 값이 겹쳐 **같은 지표인지 불명확**.
- **모호한 점**: (1) 단위가 0~1 / % 로 엔드포인트마다 다름. (2) "출하 적중률"이 출하 구성요소 점수와 **동일 지표인지 별개 지표인지**.
- **결정**: 단위는 **% 정수(0~100)로 전면 통일**(대시보드 포함). "출하 적중률"은 *권고 출하일 대비 실제 적기 출하 비율*로 **출하 구성요소와 별개 지표**로 정의하고, 분석 응답에서 component.shipping.value와 값이 우연히 같지 않도록 실제 산식 적용.

### 5. 그룹 enum·라벨, 순위(rank) 범위

- **현황**: API는 `group: "MID"`(대문자), 프론트는 `top/mid/low`(소문자)를 `상위/중위/개선 필요`로 매핑. `rank: 42 / rankTotal: 134` 추가함.
- **모호한 점**: (1) 대소문자 표기 합의. (2) `rank`가 **조합 전체 순위**인지 **그룹 내 순위**인지. (3) 그룹 경계(상/중/하) 기준 점수 구간.
- **결정**: API는 `TOP/MID/LOW` 대문자 고정(프론트가 한글 라벨 매핑). `rank`는 **조합 전체 기준 순위**(`rankTotal` = 조합 전체 조합원 수). 그룹 분류 기준(예: 상위 25% / 중위 / 하위 25%)을 명세에 별도 명시 요망.

### 6. XAI 베이스라인·기여도 합 정합성

- **현황**: 프론트 XAI는 **워터폴 차트**로, `기준점(70) + Σ기여도 = 총점`이 되도록 마지막에 보정값을 끼워 맞춤. 명세 `xaiFactors[].contribution`은 부호 있는 점수.
- **모호한 점**: (1) 기준점 70이 **고정 베이스라인인지 조합 평균인지**. (2) `Σ contribution`이 `totalScore − baseline`과 정확히 일치하도록 백엔드가 보장하는지(안 맞으면 프론트가 임의 보정).
- **결정**: 응답에 **`baseline` 필드 명시**(예: 조합 평균 or 70 고정)하고, **`baseline + Σ xaiFactors[].contribution = totalScore`를 백엔드가 정확히 맞춰서** 내려줌. 그러면 프론트 보정 로직 제거 가능.

### 7. 조회 기간(period) 기준·최신값

- **현황**: `period=yyyy-MM` 필수. 프론트는 `2026-05`를 하드코딩.
- **모호한 점**: (1) **최신 가용 월**을 어떻게 아는지(매월 갱신?). (2) period 생략 시 최신 자동 반환 여부. (3) 데이터 없는 월 요청 시 응답(빈 데이터 vs 404).
- **결정**: `period` **선택값**으로 변경 — 생략 시 **최신 집계월** 반환하고 응답에 `availablePeriods: ["2026-05", ...]` 동봉. 데이터 없는 월은 비즈니스 예외(`PERIOD_NOT_AVAILABLE`)로.

### 8. scoreHistory / cropSuitability 범위·길이

- **현황**: `scoreHistory`는 "최근 12개월", `cropSuitability`는 "현재 작목 + 대안".
- **모호한 점**: (1) 신규 조합원(가입 6개월) 등 **데이터가 12개월 미만이면** 길이가 가변인지, null 패딩인지. (2) cropSuitability **후보 작목 범위**(전 작목? 지역 재배 가능 작목? top-N?)와 개수.
- **결정**: `scoreHistory`는 **있는 만큼만**(가변 길이, 최대 12) 반환 — 프론트가 길이에 무관하게 렌더. `cropSuitability`는 **현재 작목 + 적합도 상위 대안 최대 3종**(총 4)으로 고정, 산출 출처(공공 토양·기상)를 응답 메타로 표기.

### 9. 매칭 비교(comparison)의 멘티 데이터 출처

- **현황**: 매칭 상세 응답에 `comparison[].menteeScore`(멘티 본인 점수)를 포함시킴.
- **모호한 점**: 멘티 점수는 본래 **멘티의 분석 데이터**인데, 매칭 엔드포인트가 이를 **조인해서 같이 줄지**, 프론트가 별도로 `getAnalysis(menteeId)`를 또 호출할지.
- **결정**: 매칭 상세가 `menteeId`를 받으므로 **백엔드가 멘티 component value를 조인해 `comparison`에 포함**(현재 명세대로). 프론트 추가 호출 없이 한 번에 렌더.

### 10. 권한 스코프 (분석 조회 대상)

- **현황**: `GET /members/{id}/analysis`를 **운영 책임자(임의 조합원)와 조합원 본인(자기 자신)** 둘 다 사용.
- **모호한 점**: 조합원(MEMBER)이 **다른 조합원의 memberId로 조회**하면 막는지. 운영 책임자는 **자기 조합 외 조합원**까지 보는지.
- **결정**: MEMBER는 **본인 memberId만 허용**(타인 조회 시 `403 ACCESS_DENIED`). UNION_ADMIN은 **`X-Union-Id` 범위 내 조합원만** 허용. 위반 시 403.

### 11. enum 확정 (improvementTasks / helpAreas category)

- **현황**: `improvementTasks[].category`에 임시로 `SHIPPING, PRODUCTION, CROP_CHANGE, COST, CONNECT`, `helpAreas[].category`에 `SHIPPING, PRODUCTION, QUALITY, CROP_CHANGE, COST` 등으로 적음.
- **모호한 점**: 두 enum이 **서로 다른 집합**이고, 프론트는 카테고리로 라벨/색을 정할 수 있어 **확정 목록**이 필요.
- **결정**: **공통 카테고리 enum 하나로 통일** — 예: `PRODUCTION, SHIPPING, REVENUE, QUALITY, COST, CROP_CHANGE, CONNECT`. 프론트는 이 키로 한글 라벨·배지색 매핑 테이블 관리.

---

## 부록 — 구현 정합성 점검 (2026-06-15, 배포본 vs 명세)

> 배포본 OpenAPI(`http://43.202.51.195/openapi.json`, 54 path)를 **위 명세 및 프론트 연동 기준**으로 전수 대조한 결과. 명세서엔 풍부한 응답이 이미 정의돼 있으나, **배포된 구현이 일부를 미준수**합니다. 아래는 백엔드가 **명세대로 맞춰야 할 항목** 위주.
>
> **진행 상태**: A 항목·B-2~B-10은 demo 계정 실측으로 반영 확인(2026-06-15). 프론트 전 페이지 연동 완료.
> 상태 범례: `🟡 보완 예정/수정 요청` · `✅ 완료(실측 확인)` · `🔲 협의 필요`

---

### ⭐ 백엔드 미해결 요청 사항 (2026-06-16 기준, 이것만 보면 됨)

> B-2~B-10 + B-9 + **B-12**는 **반영 확인 완료**. 아래 4건만 남음.

| # | 요청 | 우선순위 | 한 줄 요약 |
| --- | --- | --- | --- |
| ~~**B-1**~~ | API 도메인 + HTTPS | ✅ **완료** | **`https://farmu.gbsw.hs.kr`** 적용(2026-06-18 실측: HTTPS·DNS·CORS 정상, 로그인·대시보드 200). 프론트 `NEXT_PUBLIC_API_BASE_URL` 교체 완료 → mixed-content 차단 해소 |
| ~~**B-14**~~ | 출하 추천 `status`/`decidedAt` + PENDING 시드 | ✅ **완료** | 2026-06-17 실측: `data[].status`(ship_demo02=PENDING·ship_demo01=ACCEPTED)·`decidedAt` 확인, `?status=` 서버 필터 동작, PENDING 시드(ship_demo02) 존재. 프론트 자동 동작(결정 건 배지·PENDING만 버튼) |
| **B-20** | **SUPER_ADMIN 역할 + 관리자 API** (`/admin/*`) | 🔴 신규 | 프론트 `/admin` 페이지 신설. 상세 스펙은 본 명세서 "관리자(SUPER_ADMIN) API" 섹션 참조. 아래 B-20a·B-20b 선행 필요 |
| **B-20a** | **SUPER_ADMIN 계정 시드** | 🔴 선행 필수 | DB에 SUPER_ADMIN 계정 1개 생성: `loginId=system_admin`, `password=FarmU2026!`, `role=SUPER_ADMIN`, `unionCode=null`. 이 계정 없이는 `/admin/login` 로그인 불가 |
| **B-20b** | **`POST /auth/login` — `unionCode` 빈 값 허용** | 🔴 선행 필수 | SUPER_ADMIN 계정은 조합에 귀속되지 않으므로 `unionCode: ""` 로 요청 시 조합 검증 스킵 처리. 현재는 빈 unionCode → "조합을 찾을 수 없습니다" 에러로 로그인 불가 |
| **B-21** | **AI 조합원 성과 초안 자동 생성** (`POST /data/ai-draft`) | 🟡 신규 | 운영 책임자가 수동으로 CSV를 수집·업로드하는 대신, AI가 조합원 필지 데이터 + 공공데이터(기상청·흙토람·농업통계)를 교차 분석해 MEMBER_PERFORMANCE 초안을 자동 생성. 관리자가 검토·수정 후 apply로 반영. 상세 스펙은 본 명세서 "AI 성과 초안 생성" 섹션 참조 |
| **B-13** | 무효/만료 토큰 → `401` 반환 | 🟠 권장 | 현재 `400 {code:INVALID_ACCESS_TOKEN}` → 표준 `401`로. 클라 자동갱신이 401에서만 동작 (프론트 임시 대응 중) |
| ~~**B-11**~~ | `dashboard/summary` `kpiDelta` **값 채우기** | ✅ **완료** | 2026-06-18 실측: `kpiDelta = {shippingHitRate:3.8, avgRevenue:165000, reportTimeReduced:6.0}` 실제 값 들어옴. 프론트 대시보드 3개 KPI에 ▲/▼ 표기 연결 완료 |
| ~~**B-15**~~ | 데모 조합원별 **필지 시드** | ✅ **완료** | 2026-06-17 실측: `mem_demo01`·`mem_demo02` 각 2건 필지 확인. 지도/시나리오 정상 |
| ~~**B-16**~~ | **사용자 필지 등록/삭제 API** | ✅ **완료** | 2026-06-17 실측: `POST /lands`→201{landId}, `DELETE /lands/{id}`→204. 프론트 선구축 UI 그대로 동작 |
| **B-R1** | 리포트 `type` enum 명세 일치 | 🟡 정정 | 실제 허용값 `UNION`/`MONTHLY`/`MEMBER`인데 명세는 구버전 `UNION_MONTHLY`/`MEMBER_ACTION`. 완료상태도 `READY`(명세 `COMPLETED`). 프론트 정정 완료 — **백엔드: `UNION` vs `MONTHLY` 의미 구분 회신 요망** |
| **B-R2** | 리포트 PDF 본문 | 🟢 프론트 대응 | 백엔드 다운로드 PDF가 **68바이트 스텁**(`FarmU Report\n...` 텍스트). → 프론트가 **인쇄용 리포트 뷰**(`/report-print`, 실제 API 데이터로 A4 렌더 + `window.print()` → PDF 저장)로 대응 완료. 백엔드 실제 PDF 렌더는 추후 보완 시 전환 가능 |
| ~~**B-17**~~ | **시나리오 조합원 제안 API** (`POST /scenarios/{id}/propose`) | ✅ **완료** | 2026-06-18 실측: `POST /scenarios/{id}/propose` → **200** `{status:"PROPOSED", proposedAt}`. 프론트 임시 저장 방식 → 실 엔드포인트로 교체 완료 |
| ~~**B-18**~~ | **리포트 목록 역할 스코프** (`GET /reports`) | ✅ **완료** | 2026-06-18 실측: 멤버 토큰 `GET /reports`가 이제 **본인+공통만** 반환(mem_demo02 미노출). 프론트 클라 필터는 방어용으로 유지 |
| ~~**B-19**~~ | 조합원 분석 응답에 **`shippingHitRateDelta`** | ✅ **완료** | 2026-06-18 실측: `shippingHitRateDelta = 4.3` 들어옴. 프론트 출하 적중률 KPI가 자동으로 `▲/▼ vs 전월` 표기 |

> 프론트는 B-11·B-13 모두 **임시 대응 완료** 상태 → 백엔드 적용 시 자동 정상화. **유일한 차단 이슈는 B-1(도메인+HTTPS)**.
> **✅ 완료 확인(2026-06-17 실측): B-12(region), B-14(출하 status), B-15(필지 시드), B-16(필지 등록/삭제).**

---

### A. 응답이 명세보다 얇음 — 구현 보완 필요 (그대로 연동 시 화면 빈 값) · ✅ 완료(실측 확인)

**A-1. `GET /members/{id}/analysis`, `GET /members/me/analysis` — 최우선 ⭐ · ✅ 완료(실측 확인)**
실측 결과 누락 필드(name/crop/region/years/scoreDelta/rank/rankTotal/group/shippingHitRate/scoreHistory/cropSuitability/baseline) 전부 존재, components 5종 + 각 `value` 확인.
배포본 응답은 `memberId, period, totalScore, components(3종, value 없음), xaiFactors, improvementTasks, availablePeriods` 뿐. 명세(본문 "조합원 상세 분석") 대비 아래 **누락**:

| 누락 필드 | 명세 위치 | 비고 |
| --- | --- | --- |
| `name, crop, region, years` | data.* | 상세 헤더 |
| `scoreDelta, rank, rankTotal, group, shippingHitRate` | data.* | KPI 영역 |
| `components`에 `quality`, `costEfficiency` | 5종이어야 함 (현재 3종) | weight 합 100 |
| 각 `components.{key}.value` | 막대 표시값(0~100) | 현재 `score`만 있음 |
| `scoreHistory[]` | 점수 추이 차트 | |
| `cropSuitability[]` | 작목 적합도 | |
| `baseline` | XAI 워터폴 | `baseline + Σcontribution = totalScore` |
| `improvementTasks[].description` | 과제 설명 | |

**A-2. `GET /mentoring/suggestions` (목록) · ✅ 완료(소소 개명 잔여)**
`matchReasons[]`, `distanceKm` 추가 확인. ⚠️ 단 멘토 성과율이 명세 `mentorScore`가 아닌 `score` 필드로 옴 → 프론트가 `score`로 매핑(개명 미반영, 차단 아님).

**A-3. `GET /mentoring/suggestions/{id}` (상세) · ✅ 완료(소소 개명 잔여)**
`years, distanceKm, reason, tags, matchFactors[], comparison[]` 전부 + `helpAreas`를 `[{category,title,description}]` 객체배열로 확인. ⚠️ 단 멘토 작목이 `crop`이 아닌 `mainCrop` 필드로 옴 → 프론트 매핑(차단 아님).

### B. 인프라 / 전역

| # | 항목 | 명세 | 배포본 | 조치 | 상태 |
| --- | --- | --- | --- | --- | --- |
| B-1 | Base URL | `https://api.farmu.kr` | `http://43.202.51.195` (도메인·HTTPS 없음) | **도메인+TLS 필요** — 프론트 HTTPS 배포 시 mixed-content로 전 API 차단 | 🟡 보완 예정 |
| B-2 | 로그인 응답 `data.refreshToken` | 포함 | **추가됨** ✅ | 로그인 응답에 `refreshToken` 확인(2026-06-15 실측, admin·member 모두) | ✅ 완료(실측 확인) |
| B-3 | `GET /dashboard/trends` 다중 시리즈 | 다중 series | **반영됨** ✅ | A안(다중 시리즈) 적용 확인 — `series:[{group:avg\|top\|low, label, points}]` (2026-06-15 실측). 대시보드 추이 차트 실데이터 연동 완료 | ✅ 완료(실측+연동) |
| B-4 | `GET /auth/me` 응답에 `memberId` | (명세 미정) | **추가됨** ✅ | `/auth/me` 응답에 `memberId` 확인(2026-06-15 실측). 로그인 `user`엔 없고 `/auth/me`에만 있으니, 로그인 직후 me 호출로 보관 | ✅ 완료(실측 확인) |
| **B-5** | **역할(role) 2개** (`UNION_ADMIN`/`MEMBER`) | **2개로 정정됨** ✅ | `demo_consultant` 제거 확인(로그인 401), admin=UNION_ADMIN·member=MEMBER (2026-06-15 실측) | ✅ 완료(실측 확인) |
| **B-6** | `GET /dashboard/summary` 조합 집계 성과 | 200 + 집계값 | **집계됨** ✅ | 이전 전 기간 404(`PERFORMANCE_NOT_CALCULATED`) → 2026-06-15 재실측 시 `2026-05` **200** `{avgScore:81.5, scoreDelta:2.5, memberCount:2, groupDistribution{top:1,mid:1,low:0}}`. 대시보드 KPI·그룹분포·추이 실데이터 연동. (데이터 없는 기간은 404 "성과 데이터가 없습니다" — 정상, 프론트 안내문구 처리) | ✅ 완료(실측+연동) |
| **B-7** | `GET /users/me` 프로필 메타 | `unionName·joinedAt·landCount` | **추가됨** ✅ | 프로필 헤더 칩(조합명·가입일·필지수)이 소스 없어 더미였던 것 → 필드 추가 확인(2026-06-15 실측). 프론트 `Profile` 타입 확장 후 실연결 완료 | ✅ 완료(실측+연동) |
| **B-8** | 데모 데이터 시드 | 빈 배열 아님 | **시드됨** ✅ | 알림·출하추천·업로드·리포트가 빈 배열이라 화면이 비어 보이던 것 → 각 1건 이상 시드 확인(2026-06-15 실측). 화면 빈 상태 해소 | ✅ 완료(실측 확인) |
| **B-9** | 프로필 "정보 수정"에 **농가 정보** 필드 (`region` 지역 · `mainCrop` 주요 작물 · `livestock` 축산 · `unionName` 소속 조합 수정) | 없음 → **추가됨** ✅ | `PATCH /users/me` 가 `region/mainCrop/livestock/unionName` 수용(2026-06-15 실측: 저장 200 → 재조회 4개 전부 반영), `GET /users/me` 응답에도 포함 확인. 프론트 "정보 수정" 모달 4칸 + 프로필 헤더 연동 완료 | ✅ 완료(실측+연동) |

**B-9 상세 — 프로필 농가 정보 수정 ✅ 완료(2026-06-15 실측+연동)**

프론트 "정보 수정" 모달 **농가 정보** 섹션(소속 조합·지역·주요 작물·축산) + 프로필 헤더 연동 완료. 아래 사양대로 백엔드 반영 확인됨.

1. `PATCH /api/v1/users/me` (`UpdateProfileRequest`) 에 필드 추가 — 모두 optional(`string | null`):

   | 필드 | 의미 | 예시 |
   | --- | --- | --- |
   | `region` | 지역 | `"경기 안성"` |
   | `mainCrop` | 주요 작물 | `"사과, 배"` |
   | `livestock` | 축산 | `"한우 20두"` / `null`(없음) |
   | `unionName` | 소속 조합(표시명) 수정 | `"안성농협"` |

2. `GET /api/v1/users/me` (`Profile`) 응답에도 동일 필드 포함(조회용) — `region`·`mainCrop`·`livestock` 추가(`unionName`은 B-7로 이미 있음).

> 참고: 조합 소속(`unionId`)은 계정 귀속이라 변경 대상 아님. 여기서 다루는 `unionName`은 **표시용 명칭**만.

| **B-10** | `GET /members/{id}/analysis` **`xaiFactors` 값 채우기** | 요인 배열 | **채워짐** ✅ | 이전 빈 배열 → 2026-06-15 실측 시 3개 요인(생산+7.5/출하+6.5/수익+8.0), `baseline 50 + Σ21 = totalScore 72` 정합성 확인. 프론트 XAI 워터폴 차트(기준→요인별→총점) 정상 렌더 확인 | ✅ 완료(실측+연동) |
| **B-11** | `GET /dashboard/summary` **KPI 전월 대비 델타** (`kpiDelta`) | 없음 → **필드 추가됨(값 null)** ⚠️ | 2026-06-16 실측: `kpiDelta` 필드 추가 확인, 단 `{shippingHitRate:null, avgRevenue:null, reportTimeReduced:null}` 로 **값이 전부 null**(미산출). `scoreDelta`(=2.5)는 값 있음. **잔여: 실제 전월 대비 증감값 채우기** → 채워지면 KPI 카드 ▲/▼ 즉시 표기(프론트 선반영 완료) | 🟡 값 채우기 요청 |
| **B-12** | **지역(`region`) 형식 통일** — `시/도 시군구` | 제각각 → **정규화됨** ✅ | 2026-06-16 실측: `ranking`=`경상북도 경산시`·`대구광역시 동구`, `users/me`=`경기도 안성시`, `analysis`=`대구광역시 동구`, `mentoring`=`경상북도 경산시` 모두 `시/도 시군구` 확인. 프론트(데이터 기반 필터·프로필) 자동 반영. ※ `lands.address`는 상세 도로명주소(별개 필드) | ✅ 완료(실측+연동) |
| **B-13** | **무효/만료 액세스 토큰 → `401` 반환** (현재 `400`) | `401` 권장 | **요청** | 잘못된/만료 토큰으로 보호 API 호출 시 백엔드가 **`400`** `{code: INVALID_ACCESS_TOKEN}`을 반환(2026-06-15 실측). 표준은 **`401 Unauthorized`** 이며, 클라이언트 토큰 자동갱신 로직은 통상 401에서만 동작 → 400이면 갱신이 안 돌아 사용자에게 에러 노출됨. **요청: 무효/만료 토큰은 `401`로 반환.** (프론트는 임시로 `400 INVALID_ACCESS_TOKEN`도 갱신 트리거로 처리해 둠 — 401로 바뀌면 표준 경로로 동작) | 🟡 수정 요청 |

### C. 정합 확인됨 (구현 = 명세, 추가 작업 불필요)

- 요청 바디: `auth/login`, `scenarios/simulate`, `scenarios`(저장), `reports/generate`, `mentoring/matches`, `data/uploads`(`fileName/dataType/size`) — **전부 일치**
- 응답: `dashboard/summary`, `dashboard/alerts`, `members/ranking`, `shipping/recommendations`, `shipping/accuracy` — **일치**
- 누락됐던 엔드포인트 10종(data commit/revalidate/rows/목록, mentoring suggestions{id}/reject/tasks 3종, scenarios DELETE) **전부 추가 확인**
- `response_model` 49/50 지정 완료(빈 것은 `reports/{id}/download` = 파일 다운로드, 정상)

### 프론트 연동 현황 (참고)

`http://43.202.51.195` 기준 연동 현황 — **전 페이지 연동 완료** (2026-06-15):
- ✅ 로그인 · 대시보드 · 조합원 목록 · 출하 추천 · 리포트
- ✅ 내 분석 · 조합원 상세(analysis) · 멘토링(목록/상세) — A 항목 보완 확인 후 연동
- ✅ 시나리오 · 필지 — B-4(`memberId`) 보완 후 연동

### 연동 중 발견해 프론트가 흡수한 추가 불일치 (참고)
구현이 명세와 달라 프론트 매핑으로 흡수함. 가능하면 명세 정렬 권장:
| 엔드포인트 | 명세 | 배포본 | 처리 |
| --- | --- | --- | --- |
| `GET /lands` | `Land{id, areaM2, geometry, currentCrop, soilType...}` | `LandItem{landId, area, mainCrop, latitude, longitude, name, address}` | 프론트 타입을 LandItem으로 정렬 |
| `POST /scenarios/simulate` | `{baseline, projected, delta, timeline, risks, confidence}` | `{scoreChange, revenueChangePercent, riskLevel, estimatedAnnualRevenueDelta, aiAdvice{summary,actions,riskFactors}}` (AI 조언형) | 결과 패널을 AI 조언형으로 재구성 |
| `mentoring/suggestions` 멘토성과율 | `mentorScore` | `score` | 프론트 매핑 |
| `mentoring/suggestions/{id}` 작목 | `crop` | `mainCrop` | 프론트 매핑 |

---

## 부록 — 백엔드 구현 요청 메모 (B-20, 2026-06-19)

### 요청 배경

프론트에 **SUPER_ADMIN(시스템 관리자)** 역할과 `/admin` 관리 페이지가 추가됐습니다.  
해당 페이지는 UI·라우팅·API 클라이언트까지 완성된 상태이며, 아래 API들이 구현되면 즉시 연동됩니다.  
구현 전까지는 각 기능에서 "API 구현 필요" 안내 문구가 노출됩니다.

---

### 1. 선행 조건 2가지 (로그인 자체가 불가한 상태)

**① SUPER_ADMIN 계정 시드 (B-20a)**
백엔드 DB에 아래 계정을 직접 생성해 주세요.

| 필드 | 값 |
|---|---|
| loginId | `system_admin` |
| password | `FarmU2026!` |
| role | `SUPER_ADMIN` |
| unionId / unionCode | `null` |

**② `POST /auth/login` — `unionCode` 빈 값 허용 (B-20b)**
- **현재**: `unionCode`가 비어있으면 "조합을 찾을 수 없습니다" 에러 반환 → 로그인 불가
- **요청**: `role == SUPER_ADMIN`인 계정은 `unionCode: ""`(빈 문자열)로 요청 시 조합 검증 스킵
- **이유**: SUPER_ADMIN은 특정 조합에 귀속되지 않으므로 조합코드 불필요

---

### 2. 구현 우선순위

| 순위 | 엔드포인트 | 메서드 | 이유 |
|---|---|---|---|
| ★★★ | `/admin/users` | GET | 계정 목록 — 관리 페이지 첫 화면 |
| ★★★ | `/admin/users/{userId}` | DELETE | 데모 계정(mem_demo01~03) 비활성화 즉시 필요 |
| ★★☆ | `/admin/users/{userId}/reset-password` | POST | 비밀번호 분실 대응 |
| ★★☆ | `/admin/unions` | GET | 조합 목록 탭 |
| ★★☆ | `/admin/unions` | POST | 신규 조합 온보딩 |
| ★☆☆ | `/admin/unions/{unionId}` | PATCH | 조합 활성/비활성 전환 |
| ★☆☆ | `/admin/stats` | GET | KPI 카드(조합 수·조합원 수 등) |
| ★☆☆ | `/admin/notices` | GET / POST / DELETE | 시스템 공지 |
| ★☆☆ | `/admin/logs` | GET | 접속 로그 |

---

### 3. 각 API 요청/응답 스펙

본 명세서 **"관리자(SUPER_ADMIN) API"** 섹션에 전체 스펙(Request / Response 예시 포함) 작성 완료.  
별도로 전달할 내용 없이 해당 섹션 그대로 구현하면 됩니다.

---

### 4. 권한 규칙

- SUPER_ADMIN 토큰으로 `/admin/*` 요청 시 → 정상 처리
- UNION_ADMIN / MEMBER 토큰으로 `/admin/*` 요청 시 → `403 FORBIDDEN`
- 인증 없이 요청 시 → `401 UNAUTHORIZED`
- `X-Union-Id` 헤더는 `/admin/*`에서 **무시** (전 조합 접근 권한)

---

### 5. 데모 계정 삭제 요청 (별도)

아래 3개 계정을 `DELETE /admin/users/{userId}` 구현 즉시, 또는 DB에서 직접 삭제 요청합니다.

| memberId | 이름 | 아이디 |
|---|---|---|
| mem_demo01 | 김민수 | kim_minsoo |
| mem_demo02 | 이서연 | lee_seoyeon |
| mem_demo03 | 이개선 | (아이디 미확인) |


---

## 부록 — 백엔드 구현 요청 메모 (B-21, 2026-06-21)

### 1. 조합명 수정 — `PATCH /admin/unions/{unionId}`에 `name` 필드 추가

**현재 상황**
- `UpdateUnionRequest`가 `isActive` 필드만 허용 → 조합명 변경 불가
- 현재 조합명이 "FarmU 테스트조합"으로 표기됨 (프로필, 시스템 관리 등 전 페이지 노출)

**요청**
`UpdateUnionRequest`에 `name` 필드를 선택(optional)으로 추가

```json
// PATCH /api/v1/admin/unions/{unionId}
{
  "name": "합천농업법인회사",   // optional
  "isActive": true              // optional (기존 유지)
}
```

**즉시 처리 요청**
API 수정 전이라도 DB에서 `uni_demo` 레코드의 `name`을 **"합천농업법인회사"**로 직접 수정 요청합니다.

---

### 2. `POST /scenarios/simulate` — 500 에러 수정 완료 확인

이전 요청(B-20)에서 500 에러가 발생했으나 2026-06-21 기준 수정 확인됨.  
이슈 종료.


---

## 부록 — 백엔드 구현 요청 메모 (B-22, 2026-06-24)

### 1. GET /unions/members 응답에 memberId 필드 누락

**현상**
`GET /api/v1/unions/members` 응답 `data[]` 항목에 `memberId` 필드가 없거나 null입니다.
프론트 타입은 `memberId?: string`(optional)으로 선언되어 있고, 실제 응답에서 해당 값이 도달하지 않습니다.

**영향**
UNION_ADMIN이 개선 시나리오 페이지에서 조합원을 선택하면 `landsApi.getByMember(memberId)`를 호출합니다.
이때 `memberId`가 없어 빈 문자열로 호출되어 필지 목록이 항상 0개로 반환됩니다.

**프론트 임시 대응**
현재 `GET /members/ranking`으로 우회 중 — 랭킹 API는 `memberId: string`을 항상 포함하므로 정상 동작합니다.
단, 조합원 목록이 "성과 기준 상위 200명"으로 제한되는 부작용이 있습니다.

**요청**
`GET /unions/members` 응답 각 항목에 `memberId: string` 필드를 non-nullable로 추가해 주세요.

```json
// GET /api/v1/unions/members 응답 구조 — 수정 요청
{
  "data": [
    {
      "userId": "usr_001",
      "memberId": "mem_demo01",   // ← 이 필드 추가 (string, 필수)
      "loginId": "kim_minsoo",
      "name": "김민수",
      "status": "ACTIVE",
      "landCount": 2,
      "lastLoginAt": "2026-06-18T09:00:00Z"
    }
  ]
}
```

---

### ⭐ 백엔드 미해결 요청 사항 업데이트 (2026-06-24 기준)

| # | 요청 | 우선순위 | 한 줄 요약 |
| --- | --- | --- | --- |
| **B-22** | **`GET /unions/members` 응답 `memberId` 누락** | 🔴 신규 긴급 | 시나리오 페이지 필지 0개 현상의 근본 원인. 프론트 랭킹 API로 임시 우회 중. `data[].memberId: string` 추가 요청 |
| **B-20** | SUPER_ADMIN 역할 + `/admin/*` API | 🔴 신규 | B-20a·B-20b 선행 후 구현 |
| **B-20a** | SUPER_ADMIN 계정 시드 | 🔴 선행 필수 | `loginId=system_admin`, `password=FarmU2026!`, `role=SUPER_ADMIN`, `unionCode=null` |
| **B-20b** | `POST /auth/login` — `unionCode` 빈 값 허용 | 🔴 선행 필수 | SUPER_ADMIN은 조합 귀속 없음 → `unionCode:""` 시 조합 검증 스킵 |
| **B-21** | AI 성과 초안 (`POST /data/ai-draft`) + 조합명 수정 필드 | 🟡 | 상세 스펙 "AI 성과 초안 생성" 섹션 참조. `/admin/unions` PATCH에 `name` 필드도 추가 |
| **B-13** | 만료/무효 토큰 → `401` (현재 `400`) | 🟠 | 프론트 자동갱신 인터셉터 표준화. 임시 대응 중 |
| **B-R1** | 리포트 `type` enum 명세 정렬 | 🟡 | `UNION`/`MONTHLY`/`MEMBER` 의미 구분 회신 요청 |


## 부록 — 백엔드 구현 요청 메모 (B-23, 2026-06-24)

### 1. `POST /admin/notices` 요청 필드명 수정 — `body` → `content`

**현상**
기존 명세에 `body` 로 명시되어 있었으나, 실제 백엔드가 `content` 를 필수 필드로 검증하고 있음.
(`400 Bad Request: "content: Field required"` 확인됨)

**조치 완료**
프론트엔드 `POST /admin/notices` 요청 payload를 `body → content` 로 수정 완료 (2026-06-24).

**요청 구조 (확정)**
```json
POST /api/v1/admin/notices
{
  "title": "공지 제목",
  "content": "공지 내용",   // ← body 아님, content 로 고정
  "targetRole": "ALL"       // "ALL" | "UNION_ADMIN" | "MEMBER"
}
```

**응답 구조 (기존 유지)**
```json
{
  "data": {
    "noticeId": "ntc_001"
  }
}
```

**명세서 내 `POST /admin/notices` Request 섹션도 동일하게 반영 필요.**

---

### 2. `GET /notifications/unread-count` 응답 필드명 확인 요청

**현상**
프론트엔드가 기대하는 응답 구조:
```json
{
  "data": {
    "count": 3        // ← "count" 키
  }
}
```

기존 명세에는 `unreadCount` 로 기술되어 있을 수 있음. 실제 백엔드 응답 키가 어느 쪽인지 확인 후 통일 필요.

**프론트 적용 코드:**
```ts
notificationsApi.getUnreadCount().then((r) => r.data.data.count)
```

백엔드가 `unreadCount` 로 내려주고 있다면 `count` 로 통일해 주세요. (또는 백엔드 키를 알려주시면 프론트 수정)

---

### 3. 공지 등록 시 알림 자동 발송 — 신규 요청

**배경**
시스템 관리자(SUPER_ADMIN)가 공지를 등록하면, 대상 역할 유저들의 알림 목록에 자동으로 노출되어야 합니다.
프론트엔드는 이미 NotificationBell 컴포넌트가 30초 주기로 `GET /notifications/unread-count` 를 폴링하고 있어, 백엔드에서 알림 레코드만 삽입해 주면 추가 프론트 작업 없이 동작합니다.

**요청 동작**
`POST /admin/notices` 성공 시, `targetRole` 에 해당하는 모든 유저의 알림 테이블에 레코드 삽입:

| targetRole | 대상 |
| --- | --- |
| `ALL` | `UNION_ADMIN` + `MEMBER` 전원 |
| `UNION_ADMIN` | 운영 책임자만 |
| `MEMBER` | 조합원만 |

**삽입할 알림 레코드 구조** (`GET /notifications` 응답 포맷 동일):
```json
{
  "type": "NOTICE",
  "title": "[공지] {notice.title}",
  "message": "{notice.content}",
  "level": "MEDIUM",
  "isRead": false,
  "actionUrl": null
}
```

**`GET /notifications` 응답 구조 (프론트 기대값)**
```json
{
  "data": [
    {
      "id": "notif_001",
      "type": "NOTICE",
      "title": "[공지] 시스템 점검 안내",
      "message": "6월 25일 새벽 2시~4시 점검 예정입니다.",
      "level": "MEDIUM",
      "isRead": false,
      "actionUrl": null,
      "createdAt": "2026-06-24T12:00:00Z"
    }
  ]
}
```

쿼리 파라미터: `?size=10` (최신순 N개 반환)

---

### ⭐ 백엔드 미해결 요청 사항 업데이트 (2026-06-24 B-23 기준)

| # | 요청 | 우선순위 | 한 줄 요약 |
| --- | --- | --- | --- |
| **B-23a** | **`POST /admin/notices` 필드 `content` 확정** | ✅ 백엔드 이미 적용, 프론트 수정 완료 | `body → content` 로 통일 |
| **B-23b** | **`GET /notifications/unread-count` 응답 키 확인** | 🔴 확인 필요 | 프론트 `data.count` 기대 — 백엔드 실제 키 회신 요청 |
| **B-23c** | **공지 등록 시 알림 자동 발송** | 🟠 신규 기능 | `POST /admin/notices` 성공 시 대상 역할 유저 알림 테이블 삽입 (스펙 위 참조) |
| **B-22** | `GET /unions/members` 응답 `memberId` 누락 | 🔴 긴급 | 시나리오 페이지 필지 0개 근본 원인. `data[].memberId: string` 추가 요청 |
| **B-20** | SUPER_ADMIN 역할 + `/admin/*` API | ✅ 대부분 구현 완료 | B-20a·B-20b 완료 확인됨 |
| **B-21** | AI 성과 초안 + 조합명 수정 | 🟡 | 상세 스펙 "AI 성과 초안 생성" 섹션 참조 |
| **B-13** | 만료/무효 토큰 → `401` (현재 `400`) | 🟠 | 프론트 자동갱신 인터셉터 표준화. 임시 대응 중 |
| **B-R1** | 리포트 `type` enum 명세 정렬 | 🟡 | `UNION`/`MONTHLY`/`MEMBER` 의미 구분 회신 요청 |


## 부록 — 백엔드 구현 요청 메모 (B-24, 2026-06-24)

### 저장된 시나리오 상세 조회 — `GET /scenarios/{scenarioId}`

**배경**
프론트엔드 시나리오 페이지에서 저장된 시나리오 카드를 클릭하면 해당 시뮬레이션 결과와 파라미터를 불러와 결과 패널에 표시하는 기능이 필요합니다.
현재 `GET /scenarios`(목록) 응답은 `{ id, name, createdAt }` 만 반환하므로, 클릭 시 상세를 가져올 별도 엔드포인트가 필요합니다.

---

### Request

```
GET /api/v1/scenarios/{scenarioId}
Authorization: Bearer {accessToken}
```

| 파라미터 | 위치 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| scenarioId | path | string | O | 저장된 시나리오 ID |

---

### Response

```json
HTTP/1.1 200 OK
{
  "data": {
    "id": "scen_001",
    "name": "콩→옥수수 전환 시나리오",
    "createdAt": "2026-06-20T10:00:00Z",

    "params": {
      "memberId": "mem_001",
      "landId": "land_abc",
      "fromCrop": "콩",
      "toCrop": "옥수수",
      "applyAreaRatio": 0.8,
      "startPeriod": "2026-07"
    },

    "result": {
      "revenueChangePercent": 12,
      "scoreChange": 8,
      "riskLevel": "LOW",
      "estimatedAnnualRevenueDelta": 1500000,
      "aiAdvice": {
        "summary": "옥수수 전환은 해당 필지 토양 조건에 적합합니다.",
        "actions": ["파종 전 토양 pH 조정 권장", "7월 초 파종 시기 준수"],
        "riskFactors": ["여름 가뭄 시 관개 비용 증가 가능"]
      }
    }
  }
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 시나리오 ID |
| `name` | string | 저장 시 입력한 이름 |
| `createdAt` | string | 저장 시각 (ISO 8601) |
| `params.memberId` | string | 대상 조합원 ID |
| `params.landId` | string | 대상 필지 ID |
| `params.fromCrop` | string | 현행 작목 |
| `params.toCrop` | string | 전환 작목 (현행 유지 시 fromCrop과 동일) |
| `params.applyAreaRatio` | number | 적용 면적 비율 (0~1) |
| `params.startPeriod` | string | 시작 기간 (yyyy-MM) |
| `result` | object | `POST /scenarios/simulate` 응답과 동일한 구조 |
| `result.aiAdvice` | object \| null | AI 분석 없을 경우 null 허용 |

---

### 권한

| 역할 | 접근 |
| --- | --- |
| `MEMBER` | 본인 시나리오만 조회 가능 |
| `UNION_ADMIN` | 조합 내 모든 조합원 시나리오 조회 가능 |

---

### 에러

| 상태 | 코드 | 설명 |
| --- | --- | --- |
| 404 | `SCENARIO_NOT_FOUND` | 존재하지 않는 시나리오 ID |
| 403 | `ACCESS_DENIED` | 타 조합원 시나리오 접근 시도 |

---

### ⭐ 백엔드 미해결 요청 사항 업데이트 (2026-06-24 B-24 기준)

| # | 요청 | 우선순위 | 한 줄 요약 |
| --- | --- | --- | --- |
| **B-24** | **`GET /scenarios/{scenarioId}` 신규** | 🟠 신규 | 저장된 시나리오 클릭 시 결과 복원. params + result 포함 상세 응답 필요 |
| **B-23b** | `GET /notifications/unread-count` 응답 키 확인 | 🔴 확인 필요 | 프론트 `data.count` 기대 — 백엔드 실제 키 회신 요청 |
| **B-23c** | 공지 등록 시 알림 자동 발송 | 🟠 신규 | `POST /admin/notices` 성공 시 대상 역할 유저 알림 삽입 |
| **B-22** | `GET /unions/members` 응답 `memberId` 누락 | 🔴 긴급 | 시나리오 페이지 필지 0개 근본 원인. `data[].memberId: string` 추가 요청 |
| **B-21** | AI 성과 초안 + 조합명 수정 | 🟡 | 상세 스펙 "AI 성과 초안 생성" 섹션 참조 |
| **B-13** | 만료/무효 토큰 → `401` (현재 `400`) | 🟠 | 프론트 자동갱신 인터셉터 표준화. 임시 대응 중 |
| **B-R1** | 리포트 `type` enum 명세 정렬 | 🟡 | `UNION`/`MONTHLY`/`MEMBER` 의미 구분 회신 요청 |


## 부록 — 백엔드 구현 요청 메모 (B-25, 2026-06-25)

### 1. `POST /scenarios/simulate` — 현행 유지 시나리오 처리

**케이스**: `fromCrop === toCrop` 으로 요청이 들어오는 경우 (현행 작목 유지 시나리오)

**현재 동작**
- `revenueChangePercent: 0`, `estimatedAnnualRevenueDelta: 0` 반환 → 수치는 정상
- 문제: `aiAdvice.summary`가 null 또는 의미없는 값으로 반환됨

**요청**
`fromCrop === toCrop` 케이스에서도 `aiAdvice` 를 non-null로 반환 필요.

```json
// fromCrop === toCrop 일 때 aiAdvice 예시
{
  "aiAdvice": {
    "summary": "현재 작목을 유지하는 시나리오입니다. 현행 경영 방식에서의 리스크 및 개선 가능성입니다.",
    "actions": ["현행 작목의 수익성 유지를 위한 토양 관리 지속", "기상 리스크 모니터링 권장"],
    "riskFactors": ["작목 다변화 미시행 시 단작 의존도 증가 가능"]
  }
}
```

---

### 2. `POST /scenarios/simulate` — 축산 필지 시나리오 처리

**케이스**: `fromCrop`이 가축명인 경우 (예: `"한우"`, `"돼지"`, `"산란계"`)

**요청**
- 축산 → 축산 전환(예: 한우 → 육우) 시뮬레이션 결과 정상 반환
- `aiAdvice.summary`, `aiAdvice.actions`, `aiAdvice.riskFactors` 모두 non-null 반환 필수
- **`aiAdvice: null` 반환 금지** — 프론트엔드에서 처리 불가

```json
// 축산 필지 시뮬레이션 응답 예시
{
  "data": {
    "revenueChangePercent": 5.2,
    "scoreChange": 3,
    "riskLevel": "MEDIUM",
    "estimatedAnnualRevenueDelta": 800000,
    "aiAdvice": {
      "summary": "한우에서 육우로 전환 시 초기 투자 비용 대비 2~3년 내 수익 회복이 예상됩니다.",
      "actions": ["축종 전환 전 설비 점검 필요", "지역 축산 협동 조합 컨설팅 권장"],
      "riskFactors": ["육우 시장 가격 변동성 높음", "전환 초기 공백 기간 발생 가능"]
    }
  }
}
```

---

### 3. `GET /lands/{id}/suitability` — 축산 필지 candidates 반환

**케이스**: 축산 필지(가축 기반)의 적합도 조회 시 `candidates` 배열이 빈 배열로 반환되는 문제

**요청**
축산 필지에 대해서도 전환 가능한 축종 후보를 `candidates` 배열로 반환 필요

```json
// 축산 필지 suitability 응답 예시
{
  "data": {
    "landId": "land_001",
    "mainCrop": "한우",
    "candidates": [
      { "crop": "육우", "suitabilityScore": 72 },
      { "crop": "산란계", "suitabilityScore": 58 },
      { "crop": "젖소", "suitabilityScore": 65 }
    ]
  }
}
```

---

### ⭐ 백엔드 미해결 요청 사항 업데이트 (2026-06-25 B-25 기준)

| # | 요청 | 우선순위 | 한 줄 요약 |
| --- | --- | --- | --- |
| **B-25a** | **`POST /scenarios/simulate` 현행 유지 aiAdvice non-null** | 🔴 긴급 | `fromCrop === toCrop` 케이스에서 aiAdvice null 반환 금지 |
| **B-25b** | **`POST /scenarios/simulate` 축산 필지 aiAdvice non-null** | 🔴 긴급 | 축산 작목 입력 시 aiAdvice null 반환 금지 |
| **B-25c** | **`GET /lands/{id}/suitability` 축산 필지 candidates** | 🟠 신규 | 축산 필지에서도 전환 가능 축종 candidates 배열 반환 필요 |
| **B-24** | `GET /scenarios/{scenarioId}` 신규 | 🟠 신규 | 저장된 시나리오 클릭 시 결과 복원. params + result 포함 상세 응답 필요 |
| **B-23b** | `GET /notifications/unread-count` 응답 키 확인 | 🔴 확인 필요 | 프론트 `data.count` 기대 — 백엔드 실제 키 회신 요청 |
| **B-23c** | 공지 등록 시 알림 자동 발송 | 🟠 신규 | `POST /admin/notices` 성공 시 대상 역할 유저 알림 삽입 |
| **B-22** | `GET /unions/members` 응답 `memberId` 누락 | 🔴 긴급 | 시나리오 페이지 필지 0개 근본 원인. `data[].memberId: string` 추가 요청 |
| **B-21** | AI 성과 초안 + 조합명 수정 | 🟡 | 상세 스펙 "AI 성과 초안 생성" 섹션 참조 |
| **B-13** | 만료/무효 토큰 → `401` (현재 `400`) | 🟠 | 프론트 자동갱신 인터셉터 표준화. 임시 대응 중 |
| **B-R1** | 리포트 `type` enum 명세 정렬 | 🟡 | `UNION`/`MONTHLY`/`MEMBER` 의미 구분 회신 요청 |


## 부록 — 백엔드 구현 완료 확인 (B-25, 2026-06-25)

### B-25a: `POST /scenarios/simulate` 현행 유지 aiAdvice non-null ✅ 완료
- `fromCrop === toCrop` 케이스에서도 `aiAdvice` 정상 반환 확인됨
- 프론트엔드 반영 완료: `aiAdvice` null guard 처리 완료 (null인 경우 AI 분석 섹션 미표시)

### B-25b: `POST /scenarios/simulate` 축산 필지 aiAdvice non-null ✅ 완료
- 축산 작목(`한우`, `돼지`, `산란계` 등) 입력 시 `aiAdvice` 정상 반환 확인됨
- 프론트엔드 반영 완료: 동일한 null guard로 처리

### B-25c: `GET /lands/{id}/suitability` 축산 필지 candidates ✅ 완료
- 축산 필지에 대해서도 전환 가능 축종 `candidates` 배열 반환 확인됨
- 프론트엔드 반영 완료: `LandScenarioCard`에 candidates 칩 UI 추가
  - 필지 로드 시 `/lands/{id}/suitability` 자동 조회
  - 전환 작목 입력창 하단에 추천 작목 칩 표시 (점수 포함)
  - 클릭 시 `toCrop` 자동 입력

---

### ⭐ 백엔드 미해결 요청 사항 업데이트 (2026-06-25 완료 반영 기준)

| # | 요청 | 우선순위 | 한 줄 요약 |
| --- | --- | --- | --- |
| **B-25a** | `POST /scenarios/simulate` 현행 유지 aiAdvice | ✅ 완료 | 프론트 반영 완료 |
| **B-25b** | `POST /scenarios/simulate` 축산 필지 aiAdvice | ✅ 완료 | 프론트 반영 완료 |
| **B-25c** | `GET /lands/{id}/suitability` 축산 candidates | ✅ 완료 | 프론트 반영 완료 (candidates 칩 UI) |
| **B-24** | `GET /scenarios/{scenarioId}` 신규 | 🟠 신규 | 저장된 시나리오 클릭 시 결과 복원. params + result 포함 상세 응답 필요 |
| **B-23b** | `GET /notifications/unread-count` 응답 키 확인 | 🔴 확인 필요 | 프론트 `data.count` 기대 — 백엔드 실제 키 회신 요청 |
| **B-23c** | 공지 등록 시 알림 자동 발송 | 🟠 신규 | `POST /admin/notices` 성공 시 대상 역할 유저 알림 삽입 |
| **B-22** | `GET /unions/members` 응답 `memberId` 누락 | 🔴 긴급 | 시나리오 페이지 필지 0개 근본 원인. `data[].memberId: string` 추가 요청 |
| **B-21** | AI 성과 초안 + 조합명 수정 | 🟡 | 상세 스펙 "AI 성과 초안 생성" 섹션 참조 |
| **B-13** | 만료/무효 토큰 → `401` (현재 `400`) | 🟠 | 프론트 자동갱신 인터셉터 표준화. 임시 대응 중 |
| **B-R1** | 리포트 `type` enum 명세 정렬 | 🟡 | `UNION`/`MONTHLY`/`MEMBER` 의미 구분 회신 요청 |


## 부록 — 백엔드 전체 완료 확인 (2026-06-25)

모든 미해결 항목 백엔드 반영 완료 확인됨.

| # | 요청 | 상태 | 비고 |
| --- | --- | --- | --- |
| **B-25a** | `POST /scenarios/simulate` 현행 유지 aiAdvice | ✅ 완료 | 프론트 null guard 반영 완료 |
| **B-25b** | `POST /scenarios/simulate` 축산 필지 aiAdvice | ✅ 완료 | 프론트 null guard 반영 완료 |
| **B-25c** | `GET /lands/{id}/suitability` 축산 candidates | ✅ 완료 | 프론트 candidates 칩 UI 반영 완료 |
| **B-24** | `GET /scenarios/{scenarioId}` 신규 구현 | ✅ 완료 | 프론트 `scenariosApi.get()` + 상세 모달 반영 완료 |
| **B-23c** | 공지 등록 시 알림 자동 발송 | ✅ 완료 | 백엔드 처리, 프론트 추가 작업 없음 |
| **B-23b** | `GET /notifications/unread-count` 응답 키 | ✅ 완료 | `data.count` 통일 확인됨 |
| **B-22** | `GET /unions/members` 응답 `memberId` 누락 | ✅ 완료 | 프론트 `membersApi.list()` 정상 사용 중 |
| **B-21** | AI 성과 초안 + 조합명 수정 필드 | ✅ 완료 | |
| **B-13** | 만료 토큰 → `401` 응답 | ✅ 완료 | |
| **B-R1** | 리포트 `type` enum 명세 정렬 | ✅ 완료 | |

---

> 현재 신규 미해결 항목 없음 (2026-06-25 기준)
