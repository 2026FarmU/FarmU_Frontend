import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 실제 LLM 전환 시 이 키만 채우면 됨 (지금은 mock)
const LLM_KEY = process.env.ANTHROPIC_API_KEY ?? '';

interface ReportReq {
  typeKey?: string;
  typeName?: string;
  period?: string;
  target?: string;
  sections?: string[];
  role?: string;
}

// 데이터 → LLM 프롬프트 (실 모델 전환 시 이 프롬프트를 그대로 사용)
function buildPrompt(b: ReportReq): string {
  return [
    `당신은 농협 영농지도 컨설턴트입니다. 아래 정보로 ${b.typeName} 리포트를 작성하세요.`,
    `기간: ${b.period}`,
    `대상: ${b.target ?? '조합 전체'}`,
    `포함 섹션: ${(b.sections ?? []).join(', ')}`,
    `요약, 핵심 지표, 우선 실행 과제(액션플랜)를 자연어로, 농가가 이해하기 쉽게.`,
  ].join('\n');
}

// 목업 자연어 리포트 (LLM 응답 형식과 동일하게 — 나중에 교체 쉬움)
function mockReport(b: ReportReq): string {
  const period = b.period ?? '이번 달';
  const isMember = b.role === 'MEMBER';
  if (isMember) {
    return [
      `## ${period} ${b.typeName} 요약`,
      ``,
      `이번 기간 종합 성과율은 **85.2점**으로 전월 대비 **+3.2점** 상승했습니다. 생산성(82)과 출하 적중률(88)이 고르게 개선되었고, 수익성(78)은 자재비 부담으로 소폭 정체되었습니다.`,
      ``,
      `### 우선 실행 과제 (AI 추천)`,
      `1. **출하 시기 조정** — 최근 7일 가격 모멘텀이 +5.1%로, 다음 출하를 1주 앞당기면 약 6% 추가 수익이 기대됩니다.`,
      `2. **자재비 절감** — 동일 경축 상위 농가 대비 자재비가 14% 높습니다. 공동구매 활용 시 연 84만원 절감 가능.`,
      `3. **토양 관리** — 필지 적합도 분석상 배수 개선이 필요합니다. 다음 작기 전 암거배수 검토를 권장합니다.`,
      ``,
      `> 본 리포트는 팜맵·토양검정·기상 공공데이터와 출하 이력을 AI가 분석해 생성했습니다.`,
    ].join('\n');
  }
  return [
    `## ${period} ${b.typeName}`,
    ``,
    `조합 전체 평균 성과율은 **76.8점**으로 전월 대비 **+1.9점** 상승했습니다. 상위 그룹 32%, 중위 49%, 개선 필요 19%로 분포하며, 개선 필요 그룹이 전월 대비 3%p 감소했습니다.`,
    ``,
    `### 핵심 지표`,
    `- 출하 권고 적중률: **85%** (전월 82%)`,
    `- 경축 적합도 평균: **78점**`,
    `- 멘토링 진행 매칭: 12건 (완료 37건)`,
    ``,
    `### 운영 우선 과제 (AI 추천)`,
    `1. **개선 필요 그룹 집중 관리** — 윤○○·홍○○ 등 4개 농가의 수익성 지표가 하락세입니다. 멘토링 매칭과 자재 공동구매를 우선 연결하세요.`,
    `2. **출하 분산 권고** — 한우 출하가 6월 둘째 주에 집중돼 가격 변동성이 큽니다. 분할 출하로 변동성 34% 완화가 가능합니다.`,
    `3. **경축 전환 검토** — 적합도 60 미만 필지 8곳에 대해 배·인삼 전환 시나리오를 제안합니다.`,
    ``,
    `> 본 리포트는 조합원 성과·출하·팜맵 데이터를 AI가 종합 분석해 자동 생성했습니다.`,
  ].join('\n');
}

export async function POST(req: NextRequest) {
  const body: ReportReq = await req.json().catch(() => ({}));
  const prompt = buildPrompt(body);

  // 실제 LLM 전환 지점 — ANTHROPIC_API_KEY가 있으면 Claude 호출로 교체
  // if (LLM_KEY) {
  //   const text = await callClaude(prompt);  // anthropic SDK
  //   return NextResponse.json({ title, text, model: 'claude' });
  // }

  const text = mockReport(body);
  const title = `${body.period ?? ''} ${body.typeName ?? '리포트'}`.trim();
  return NextResponse.json({
    title,
    text,
    model: LLM_KEY ? 'claude(준비됨)' : 'mock-report-v0',
    _prompt: prompt,
  });
}
