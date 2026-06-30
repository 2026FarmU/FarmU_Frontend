# 팜유 AI 명세서 v1

> 이 문서는 **AI/모델 구현에 필요한 부분만** 다룹니다. API 경로·응답 스키마·단위·에러는 [백엔드 API 명세서.md](백엔드%20API%20명세서.md)에 있고, 여기서는 그 응답의 어느 필드를 **어떤 입력·모델로 산출하는지**(피처 → 처리 → 출력 매핑)만 추가로 정의합니다.

---

## 1. 개요

### 1.1 실질적으로 구현해야 할 AI

7개 기능 전부를 "처음부터 학습한 모델"로 만들 필요는 없습니다. **구현 유형**에 따라 실제 작업량이 크게 다릅니다.

> **결론 먼저 — MVP에서 진짜 만들어야 하는 핵심 AI는 3개: `AI-1 적합도` · `AI-2 LLM 리포트` · `AI-3 성과율/XAI`**
> 이 3개가 "농업 공공데이터 + AI" 가치를 실제로 구현합니다. 나머지 AI-4~7은 **MVP에선 규칙/휴리스틱으로 동작**시키고, 데이터가 쌓인 뒤 본격 ML로 승급합니다.

| ID | 기능 | 구현 유형 | 실질 작업량 | MVP |
| --- | --- | --- | --- | --- |
| **AI-1** | 작목 적합도 | 공공데이터 규칙 → ML 고도화 | 中 (규칙기반 stub 有) | ★ **핵심** |
| **AI-2** | 생성형 리포트 | **LLM(Claude) 호출** — 학습 불필요 | 低 (프롬프트+데이터, 키 연결) | ★ **핵심** |
| **AI-3** | 성과율 + XAI | 가중수식 + SHAP 설명 | 中 (무거운 학습 불필요) | ★ **핵심·전 화면 기반** |
| AI-4 | 출하 적기 추천 | 시계열 가격예측 | 高 (본격 ML, 시세·이력 필요) | △ MVP는 규칙 휴리스틱 |
| AI-5 | 시나리오 시뮬레이션 | 예측 회귀 | 高 | △ MVP는 적합도+수익 수식 |
| AI-6 | 멘토 매칭 | 유사도 스코어링 | 低~中 (규칙 가능) | △ 규칙으로 MVP |
| AI-7 | 위험 알림 탐지 | 임계·이상탐지 | 低 (규칙 가능) | △ 규칙으로 MVP |

**핵심 3종이 우선인 이유**
- **AI-1**: 공공데이터(토양검정·농업기상)를 직접 소비하는 **유일한 데이터-네이티브 AI** — 경진대회 테마의 본체. 규칙기반 stub이 이미 있어 데이터 연동→고도화 경로가 짧음.
- **AI-2**: **학습이 필요 없는 LLM 호출**이라 투입 대비 데모 임팩트가 가장 큼. `ANTHROPIC_API_KEY`만 연결하면 자리 잡힌 프롬프트로 즉시 동작.
- **AI-3**: 모든 화면·리포트·매칭의 **입력이 되는 기반 점수**. 무거운 학습 없이 가중수식+SHAP로 구현 가능하나, 이게 없으면 전 화면이 mock에 머무름.

| ID | 현재 코드 상태 | 산출물이 채우는 API |
| --- | --- | --- |
| AI-1 | 🟡 규칙기반 stub (`api/ai/suitability`, `farmu-suitability-v0`) | `GET /lands/{id}/suitability`, `members/{id}/analysis`의 `cropSuitability` |
| AI-2 | 🟡 Claude 연동 stub (`api/ai/report`, `ANTHROPIC_API_KEY`) | `POST /reports/generate` 결과물(본문) |
| AI-3 | 🔴 모델 없음(프론트 mock) | `GET /members/{id}/analysis` |
| AI-4 | 🔴 모델 없음(mock) | `GET /shipping/recommendations` |
| AI-5 | 🔴 모델 없음(mock) | `POST /scenarios/simulate` |
| AI-6 | 🔴 모델 없음(mock) | `GET /mentoring/suggestions`, `suggestions/{mentorId}` |
| AI-7 | 🔴 모델 없음(mock) | `GET /dashboard/alerts` |

### 1.2 공통 규칙 (AI 산출 전반)

| 항목 | 규칙 |
| --- | --- |
| 점수·적합도 단위 | 사용자 노출 점수·적합도는 **0~100 정수**(백엔드 명세 규칙과 동일) |
| 모델 확률값 | `confidence`(예측 신뢰도)·`riskFactors[].score`(위험 가중)는 **0~1 실수** 유지 (내부 판단용) |
| 결정성 보장 | XAI: `baseline + Σ contribution = totalScore`, 구성요소: `Σ score = totalScore`를 **AI가 맞춰서** 산출 |
| 산출 메타 | 모든 AI 응답에 `model`(모델/버전), `generatedAt`(산출 시각)을 포함 권장 |
| 설명가능성 | 점수형 AI(AI-1·3·4·6)는 **근거(reasons/factors)** 를 반드시 동반 (블랙박스 금지) |

### 1.3 실행 위치 (결정 필요)

현재 AI-1·AI-2는 **프론트 BFF(Next `api/ai/*`)에서 직접 실행**(AI-2는 Claude 직접 호출)됩니다. AI-3~7은 미구현입니다.
→ **권장**: AI를 **별도 AI 서비스/백엔드가 소유**하고, 프론트 `api/ai/*` 는 추후 백엔드 프록시로 교체. 본 명세는 "백엔드/AI 서비스 소유" 기준으로 작성합니다. (다르게 갈 경우 이 절만 갱신)

### 1.4 공공데이터 소스 (AI 입력)

| 코드 | 데이터셋 | 기술문서 | 주 사용 AI |
| --- | --- | --- | --- |
| FARMMAP | 팜맵 조회(필지 경계·면적·지목) | 1차_팜맵조회 | AI-1, AI-5 |
| SOIL | 팜맵 토양검정(토성·유기물·pH·성분) | 2차_팜맵토양검정 | AI-1, AI-5 |
| WEATHER | 팜맵 농업기상(기온·강수·일조) | 2차_팜맵농업기상 | AI-1, AI-4, AI-7 |
| PEST | 팜맵 병해충발생 | 2차_팜맵병해충발생 | AI-7 |

내부 데이터: 조합원 성과·출하 이력·작목·필지(조합 업로드 `data/uploads`).

---

## 2. AI-1 작목 적합도

**목적**: 필지 환경·작목 지식으로 작목별 재배 적합도(0~100)와 추천 순위를 산출.

### 입력 피처

| 피처 | 출처 | 비고 |
| --- | --- | --- |
| 토성(soil) | SOIL | 사양토/양토/식양토/사토 등 |
| 유기물·pH·성분 | SOIL | (모델 고도화 시) |
| 고도(altitude)·경사(slope) | FARMMAP | |
| 기온·강수·일조 평년값 | WEATHER | |
| 현재 작목(currentCrop) | 내부 | 현재 작목 강조용 |

### 처리

- **현재**: 규칙기반(`farmu-suitability-v0`) — 작목 지식베이스(적정 토성/고도/경사/기준수익/위험)에 가감점. ([`api/ai/suitability/route.ts`](FarmU_Frontend/src/app/api/ai/suitability/route.ts) 참고)
- **목표 모델**: 공공데이터 라벨(실제 재배·수확량) 학습 기반 회귀/랭킹 모델로 대체. 규칙기반은 cold-start fallback으로 유지.

### 출력 → API 매핑

- `GET /lands/{id}/suitability`: `candidates[].suitabilityScore`, `candidates[].factors{soil,climate,slope,sunlight}`(각 0~100), `candidates[].rank`, `candidates[].riskFactors`, `expectedRevenuePerHa`
- `members/{id}/analysis`: `cropSuitability[]{crop, fitScore, current}`
- 권장 추가: 자연어 `summary`(상위 작목 설명), `model` 필드

---

## 3. AI-2 생성형 리포트 (LLM)

**목적**: 조합/조합원 데이터를 LLM이 분석해 **자연어 월간 리포트·액션플랜**을 생성.

### 입력 피처

- 대상 성과율·구성요소·XAI(AI-3 산출), 출하 적중률·추천 이력(AI-4), 그룹 분포, 멘토링 현황
- 파라미터: `typeName`(조합 월간/조합원 액션플랜), `period`, `target`, `sections[]`, `role`

### 처리

- **LLM**: Anthropic Claude (`ANTHROPIC_API_KEY`). 프롬프트는 [`api/ai/report/route.ts`](FarmU_Frontend/src/app/api/ai/report/route.ts)의 `buildPrompt` 사용 — "농협 영농지도 컨설턴트" 페르소나, 요약·핵심지표·우선 실행과제(액션플랜)를 농가 친화 자연어로.
- 모델 권장: 최신 Claude 모델(`claude-opus-4-x` 계열). 데이터는 **프롬프트에 구조화 주입**(RAG 불필요, 조합 데이터 규모상 직접 컨텍스트).
- 안전장치: 수치는 입력 데이터 그대로 인용(환각 방지), 미존재 데이터는 생성 금지.

### 출력 → API 매핑

`POST /reports/generate` 는 현재 **PDF 파일(downloadUrl)** 산출만 정의됨. **추가 필요** — LLM 자연어 본문을 응답/리포트에 포함:

```json
{
  "data": {
    "id": "rpt_5e8f",
    "title": "2026-05 조합 월간 리포트",
    "content": "## 2026-05 ...(마크다운 자연어 본문)...",
    "model": "claude-opus-4-x",
    "downloadUrl": "https://cdn.farmu.kr/reports/rpt_5e8f.pdf",
    "generatedAt": "2026-05-27T10:00:00+09:00"
  }
}
```

| 추가 필드 | Type | 설명 |
| --- | --- | --- |
| data.title | String | 리포트 제목 |
| data.content | String | LLM 생성 자연어 본문(마크다운). 화면 인라인 렌더용 |
| data.model | String | 사용 모델/버전 |
| data.generatedAt | String | 생성 시각 |

> PDF는 `content`를 렌더해 생성. 인라인 표시(현 `api/ai/report`)와 PDF가 **같은 `content`** 를 쓰도록 단일화.

---

## 4. AI-3 성과율 + XAI 분석

**목적**: 조합원 성과율(0~100)을 구성요소 가중합으로 산출하고, XAI로 기여 요인을 분해.

### 입력 피처

- 생산성(수확량/단수), 출하(적기 출하율·물량), 수익성(매출·비용), 품질(상품과율), 비용효율(자재비) — 내부 성과·출하 데이터
- 조합 내 분포(백분위·순위 산출용)

### 처리

- 구성요소별 점수(value 0~100) → 가중치 적용 → `totalScore`. **`Σ(value×weight/100) = totalScore` 보장.**
- XAI: SHAP 등 기여도 분해. **`baseline`(조합 평균 또는 고정 기준) + Σ contribution = totalScore` 보장.**
- 그룹 분류(TOP/MID/LOW) 기준 점수 구간은 조합 정책값.
- 개선 과제(improvementTasks): 음의 기여 요인 → 액션 + `expectedImpact{scoreDelta, revenueDelta}` 추정.

### 출력 → API 매핑

`GET /members/{id}/analysis` 전체 — `totalScore, components{5종, value/score/weight/percentile}, scoreHistory[], baseline, xaiFactors[], improvementTasks[], group, rank`.

---

## 5. AI-4 출하 적기 추천

**목적**: 작목·시세·기상으로 출하 의사결정(SHIP/HOLD/SPLIT)과 예상 수익·위험을 추천.

### 입력 피처

- 생육 단계·물량(내부), 품목 시세·가격 모멘텀(시세 데이터), 기상(WEATHER)
- 과거 추천 채택·적중 이력(피드백 학습)

### 처리

- 가격 예측 + 의사결정 정책 모델. 출력에 **`confidence`(0~1)**, `riskFactors[]{type, score(0~1), note}`(예: PRICE_VOLATILITY) 동반.
- 권고: `SHIP`/`HOLD`/`SPLIT_SHIP`/`REVIEW`.

### 출력 → API 매핑

`GET /shipping/recommendations`: `recommendedDate, recommendedAction, confidence, expectedRevenue{min,expected,max}, riskFactors[], rationale`. 적중률 이력은 `GET /shipping/accuracy`.

---

## 6. AI-5 개선 시나리오 시뮬레이션

**목적**: 작목 전환·면적 조정 등 변경의 **성과율·수익 변화를 예측**.

### 입력 피처

- 대상 필지 적합도(AI-1), 현재/변경 작목, 적용 면적 비율(`applyAreaRatio`), 시작 시점
- 토양·기상(SOIL/WEATHER), 기준 작목 수익 모델

### 처리

- baseline(현재) vs projected(변경 후) 예측. 분기별 timeline, 초기 투자(risks), `confidence`(0~1) 산출. 비동기(`202`) 처리.

### 출력 → API 매핑

`POST /scenarios/simulate`: `baseline{score,annualRevenue}, projected{...}, delta{scorePoint, revenue, revenuePct}, timeline[], risks[], confidence`.

---

## 7. AI-6 멘토 매칭 스코어링

**목적**: 멘티와 후보 멘토의 **매칭 적합도(0~100)** 와 요인별 근거를 산출.

### 입력 피처

- 작목 일치, 토양·환경 유사도, 거리(FARMMAP 좌표), 멘토 성과·노하우(출하 적중률 등), 경험 연차
- 멘티 약점(AI-3의 하위 구성요소) ↔ 멘토 강점 매칭

### 처리

- 요인별 적합도(0~100) → 가중 평균 → `matchScore`. 멘티-멘토 구성요소 비교(`comparison`) 동반.

### 출력 → API 매핑

- `GET /mentoring/suggestions`: `matchScore, matchReasons[], mentorScore, distanceKm`
- `GET /mentoring/suggestions/{mentorId}`: `matchFactors[]{factor,score}, comparison[]{category,menteeScore,mentorScore}, helpAreas[]`

---

## 8. AI-7 위험 알림 탐지

**목적**: 가격·기상·병해충·수급 이상을 탐지해 조합 위험 알림 생성.

### 입력 피처

- 시세 급락(가격 데이터), 기상 이상(WEATHER), 병해충 발생(PEST), 수급 충격
- 조합원 성과 하락 추세(AI-3)

### 처리

- 임계/이상탐지 → 알림 레벨(HIGH/MEDIUM/LOW) + 대상 + actionUrl. 유형: PRICE_DROP, WEATHER, SUPPLY_SHOCK, SHIPPING_WINDOW.

### 출력 → API 매핑

`GET /dashboard/alerts`: `level, type, title, description, target, actionUrl`.

---

## 9. 우선순위 (제안)

1. **AI-3 (성과율·XAI)** — 모든 화면·리포트의 기반. 가장 먼저.
2. **AI-1 (적합도)** — stub 존재, 공공데이터 직접 활용해 경진대회 핵심.
3. **AI-2 (LLM 리포트)** — stub 존재, Claude 키만 연결. 데모 임팩트 큼.
4. AI-4 출하 → AI-5 시나리오 → AI-6 매칭 → AI-7 알림.

> 🟡(stub) 2종은 "교체"만, 🔴(mock) 5종은 "신규 구현"이 필요합니다.
