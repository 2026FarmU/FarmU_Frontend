import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// 한국 농업기후권역 (농촌진흥청 기준)
// ─────────────────────────────────────────────
type ClimateZone = 'warm_south' | 'warm_coast' | 'central' | 'highland' | 'jeju';
function inferClimate(address: string, altitude: number): ClimateZone {
  const a = address ?? '';
  if (a.includes('제주')) return 'jeju';
  if (altitude >= 500) return 'highland';
  const highland_kw = ['평창','정선','태백','화천','양구','인제','철원','홍천','영월','횡성'];
  if (highland_kw.some(k => a.includes(k)) || altitude >= 350) return 'highland';
  const warm = ['전라남도','경상남도','부산','광주','전남','경남','여수','통영','순천','목포','나주','광양','창원','진주','고흥','보성','강진','완도','해남','장흥','담양','고성','사천','남해','하동'];
  const coast = ['충청남도','충남','보령','서산','당진','태안','홍성','예산','아산','인천','시흥','화성','평택'];
  if (warm.some(k => a.includes(k))) return 'warm_south';
  if (coast.some(k => a.includes(k))) return 'warm_coast';
  return 'central';
}
const CLIMATE_LABEL: Record<ClimateZone, string> = {
  warm_south: '남부 온난다우', warm_coast: '서해안 해양성', central: '중부 온대', highland: '고랭지·산간', jeju: '제주 아열대',
};

// ─────────────────────────────────────────────
// 지역 수매 특화 작목 (농협 수매 기준)
// ─────────────────────────────────────────────
const REGIONAL_SPECIALTIES: Array<{ keys: string[]; crops: string[]; note: string }> = [
  { keys: ['나주'], crops: ['배','사과'], note: '나주 배 전국 수매 1위 산지' },
  { keys: ['해남'], crops: ['고구마','마늘','양파','배추'], note: '해남 월동채소 집산지, 농협 계약재배' },
  { keys: ['담양'], crops: ['딸기','고추'], note: '담양 딸기·고추 특산, 로컬푸드 연계' },
  { keys: ['고흥'], crops: ['마늘','양파'], note: '고흥 마늘·양파 농협 계약재배' },
  { keys: ['보성'], crops: ['벼'], note: '보성 쌀 수매 안정' },
  { keys: ['강진','장흥'], crops: ['한우','벼'], note: '강진·장흥 한우 브랜드 수매' },
  { keys: ['영천'], crops: ['포도','사과'], note: '영천 샤인머스캣 전국 최대 산지' },
  { keys: ['상주'], crops: ['사과','포도'], note: '상주 사과·포도 농협 공동선별' },
  { keys: ['안동'], crops: ['사과','고추'], note: '안동 사과·고추 계약재배 비중 높음' },
  { keys: ['의성'], crops: ['마늘','사과'], note: '의성 마늘 전국 최대 산지' },
  { keys: ['군위','청송'], crops: ['사과'], note: '사과 주산지, 저온저장 농협 운영' },
  { keys: ['논산'], crops: ['딸기','배'], note: '논산 딸기 전국 최대 출하' },
  { keys: ['부여'], crops: ['수박','참외'], note: '부여 수박·참외 농협 공동선별' },
  { keys: ['서산','태안'], crops: ['마늘','양파'], note: '서산 6쪽마늘 원산지 수매' },
  { keys: ['홍성'], crops: ['한우','벼'], note: '홍성한우 브랜드 조합 직판' },
  { keys: ['정읍','김제','익산','군산'], crops: ['벼','콩'], note: '호남 평야 쌀·콩 농협 RPC' },
  { keys: ['고창'], crops: ['수박'], note: '고창 수박 공동출하 체계' },
  { keys: ['남원'], crops: ['고추','벼'], note: '남원 고추 주산지' },
  { keys: ['제주'], crops: ['감귤','당근','브로콜리'], note: '제주 감귤 조합 수매 전담' },
  { keys: ['평창','정선'], crops: ['고랭지배추','감자'], note: '고랭지 채소 수매 프리미엄' },
  { keys: ['철원'], crops: ['벼'], note: '철원 오대쌀 브랜드 RPC' },
  { keys: ['합천','산청','함양'], crops: ['한우','딸기'], note: '경남 내륙 한우·딸기 특산' },
  { keys: ['밀양'], crops: ['사과','감'], note: '밀양 얼음골사과 수매' },
  { keys: ['거창'], crops: ['사과','포도'], note: '거창 사과 고품질 공동선별' },
];
function getSpecialty(address: string) {
  for (const r of REGIONAL_SPECIALTIES) {
    if (r.keys.some(k => address.includes(k))) return r;
  }
  return null;
}

// ─────────────────────────────────────────────
// 토양 분류 (농촌진흥청 흙토람)
// ─────────────────────────────────────────────
type SoilClass = 'sandy' | 'loam' | 'clay_loam' | 'clay' | 'volcanic' | 'alluvial' | 'unknown';
function classifySoil(s: string): SoilClass {
  const v = (s ?? '').toLowerCase();
  if (v.includes('사질')) return 'sandy';
  if (v.includes('화산') || v.includes('제주')) return 'volcanic';
  if (v.includes('충적') || v.includes('하천')) return 'alluvial';
  if (v.includes('식토') && !v.includes('양')) return 'clay';
  if (v.includes('식양') || v.includes('미사식양') || v.includes('양식')) return 'clay_loam';
  if (v.includes('양토') || v.includes('미사양') || v.includes('사양')) return 'loam';
  return 'unknown';
}
const SOIL_LABEL: Record<SoilClass, string> = {
  sandy: '사질토(배수양호·보수불량)', loam: '양토(이화학성 균형)',
  clay_loam: '식양토(보수력 우수)', clay: '식토(배수불량)',
  volcanic: '화산회토(통기성 우수)', alluvial: '충적토(지력 양호)', unknown: '미분류',
};
function slopeGrade(sl: number) { return sl < 3 ? '평탄' : sl < 15 ? '완경사' : '급경사'; }

// ─────────────────────────────────────────────
// 경축 DB — 필지 종류별 엄격 분리, 현실적 작목만
// ─────────────────────────────────────────────
type Cat = '논' | '밭' | '과수' | '시설' | '축산';
interface CropDef {
  name: string; base: number; revenue: number; risk: number;
  goodZones: ClimateZone[]; goodSoils: SoilClass[]; maxSlope: number; maxAlt: number;
  desc: string; soilNote: string; climateNote: string;
}

const CROPS: Record<Cat, CropDef[]> = {
  // 논: 벼 중심 + 실제 이모작 가능한 작목만
  논: [
    { name: '벼', base: 92, revenue: 2900, risk: 1, goodZones: ['warm_south','central','warm_coast'], goodSoils: ['alluvial','clay_loam','loam'], maxSlope: 3, maxAlt: 350, desc: '논 기본 수도작, 농협 RPC 수매 보장 — 가장 안정적', soilNote: '충적토·식양토 최적 수량', climateNote: '중부 이남 평야지 안정 생육' },
    { name: '이탈리안 라이그라스', base: 85, revenue: 900, risk: 1, goodZones: ['warm_south','central','warm_coast'], goodSoils: ['alluvial','loam','clay_loam'], maxSlope: 5, maxAlt: 350, desc: '벼 수확 후 동계 이모작 대표 조사료, 축산 농협 수매 — 관리 단순', soilNote: '충적토·양토 수량 안정', climateNote: '남부~중부 10월 파종, 5월 수확 이모작 최적' },
    { name: '콩', base: 80, revenue: 3200, risk: 2, goodZones: ['central','warm_south','warm_coast'], goodSoils: ['loam','clay_loam','alluvial'], maxSlope: 8, maxAlt: 400, desc: '논 타작물 전환·이모작 대표, 농협 계약재배 지원·지력 향상', soilNote: '배수 양호 양토에서 근류균 활성 최대', climateNote: '중부 이남 6월 파종·10월 수확 이모작' },
    { name: '청보리', base: 78, revenue: 800, risk: 1, goodZones: ['warm_south','central','warm_coast'], goodSoils: ['alluvial','loam'], maxSlope: 5, maxAlt: 300, desc: '동계 총체 사료작물, 이탈리안 라이그라스와 이모작 경합 — 축산 연계 수매', soilNote: '충적토·양토 총체 수량 높음', climateNote: '11월 파종, 5월 수확 — 남부~중부 안정' },
    { name: '마늘', base: 76, revenue: 5600, risk: 2, goodZones: ['warm_south','warm_coast'], goodSoils: ['loam','alluvial'], maxSlope: 5, maxAlt: 250, desc: '벼 후작 월동작물, 남부·서해안 논에서 소득 이모작으로 정착', soilNote: '양토 배수 양호 시 인편 비대 최상', climateNote: '전남·충남 해안지 10월 파종·6월 수확' },
    { name: '양파', base: 74, revenue: 5200, risk: 2, goodZones: ['warm_south'], goodSoils: ['alluvial','loam'], maxSlope: 4, maxAlt: 200, desc: '벼-양파 이모작, 전남·경남 논에서 검증된 소득 작목', soilNote: '충적토·양토 구 비대 우수', climateNote: '전남·경남 남부 온난지 월동 안정' },
    { name: '호밀', base: 70, revenue: 700, risk: 1, goodZones: ['central','warm_coast','highland'], goodSoils: ['loam','sandy','alluvial'], maxSlope: 8, maxAlt: 500, desc: '동계 조사료, 내한성 강해 중부·고랭지 이모작 가능 — 저비용', soilNote: '사양토·양토 모두 적응', climateNote: '중부 이상 내한성 가장 강한 동계 조사료' },
  ],
  // 밭: 실제 노지 밭작물, 경사·토양 반영
  밭: [
    { name: '고추', base: 86, revenue: 4800, risk: 2, goodZones: ['central','warm_south'], goodSoils: ['loam','clay_loam'], maxSlope: 15, maxAlt: 450, desc: '노지 밭 대표 수매 작목, 농협 건고추 공동선별 전국 운영', soilNote: '양토·식양토 배수 양호 역병 예방', climateNote: '중부내륙 건조 기후 고품질' },
    { name: '마늘', base: 84, revenue: 5600, risk: 2, goodZones: ['warm_south','warm_coast','central'], goodSoils: ['loam','alluvial'], maxSlope: 10, maxAlt: 300, desc: '월동 밭작물, 농협 마늘 수매 전국 네트워크 — 기계화 보편화', soilNote: '양토 배수 양호 인편 비대', climateNote: '남해안·서해안 해양성 기후 최적' },
    { name: '양파', base: 82, revenue: 5200, risk: 2, goodZones: ['warm_south','warm_coast'], goodSoils: ['alluvial','loam'], maxSlope: 6, maxAlt: 200, desc: '농협 양파 수매·저장 체계 완비 지역 우선, 고소득 안정작목', soilNote: '충적토·양토 구 비대·저장성 우수', climateNote: '전남·경남 해안지 월동 안정' },
    { name: '콩', base: 76, revenue: 3200, risk: 1, goodZones: ['central','warm_south'], goodSoils: ['loam','sandy','clay_loam'], maxSlope: 12, maxAlt: 450, desc: '윤작 지력 회복, 농협 계약재배 지원 — 재배 단순', soilNote: '배수 양호 양토 근류균 활성', climateNote: '중부 이남 서리 전 수확 가능' },
    { name: '고구마', base: 78, revenue: 4000, risk: 1, goodZones: ['warm_south','central','warm_coast'], goodSoils: ['sandy','loam'], maxSlope: 10, maxAlt: 300, desc: '농협 고구마 계약재배, 저장성 우수·수요 연중 안정', soilNote: '사질토·사양토 모양·당도 최상', climateNote: '남부 온난지 최적, 중부 이남 재배 가능' },
    { name: '감자', base: 76, revenue: 3500, risk: 1, goodZones: ['highland','central'], goodSoils: ['loam','sandy'], maxSlope: 15, maxAlt: 700, desc: '고랭지·중부 봄 재배, 농협 수매 체계 안정 — 이모작 가능', soilNote: '배수 양호 사양토 모양·크기 균일', climateNote: '고랭지 봄·여름 고품질, 중부 2기작 가능' },
    { name: '배추', base: 74, revenue: 3600, risk: 2, goodZones: ['highland','central'], goodSoils: ['loam','clay_loam'], maxSlope: 12, maxAlt: 700, desc: '작형 다양(고랭지·가을·월동), 농협 공동계산제 운영', soilNote: '유기물 풍부 양토 결구 우수', climateNote: '고랭지 여름배추 타지역 품질 우위' },
    { name: '참깨', base: 70, revenue: 6200, risk: 2, goodZones: ['central','warm_south'], goodSoils: ['sandy','loam'], maxSlope: 12, maxAlt: 350, desc: '고단가 유지작물, 지역 농협 참기름 가공 연계 가능', soilNote: '사양토·사질토 배수 필수 — 과습 역병 치명', climateNote: '건조 중부내륙 품질 우수' },
  ],
  // 과수: 과수원 적합 작목, 논·밭에서는 절대 추천 안 함
  과수: [
    { name: '사과', base: 86, revenue: 6100, risk: 2, goodZones: ['central','highland'], goodSoils: ['loam','clay_loam'], maxSlope: 20, maxAlt: 600, desc: '과수 농협 공동선별장 — 안정된 수매 경로, 기후변화로 중부·고랭지 적지 확대', soilNote: '심토 배수 양호 양토 당도·착색', climateNote: '기온 상승으로 고랭지·중부내륙 적지 이동 중' },
    { name: '포도(샤인머스캣)', base: 88, revenue: 8500, risk: 3, goodZones: ['central','warm_south'], goodSoils: ['loam','sandy'], maxSlope: 20, maxAlt: 400, desc: '샤인머스캣 수요 폭증, 지역 과수 농협 수매 최고단가 — 시설 지원 필요', soilNote: '배수 양호 양토·사양토 당도 최상', climateNote: '일교차 큰 중부내륙 착색·당도 우수' },
    { name: '배', base: 82, revenue: 6800, risk: 1, goodZones: ['warm_south','central','warm_coast'], goodSoils: ['alluvial','loam'], maxSlope: 15, maxAlt: 300, desc: '과수원 병해 관리 안정적, 나주·천안 등 주산지 농협 수매 체계', soilNote: '충적토·양토 과실 비대 우수', climateNote: '남부·서해안 온난다우 고품질' },
    { name: '복숭아', base: 78, revenue: 5400, risk: 2, goodZones: ['warm_south','central'], goodSoils: ['sandy','loam'], maxSlope: 20, maxAlt: 400, desc: '온난지 과수원, 지역 농협 복숭아 수매 운영 — 봄 늦서리 주의', soilNote: '사양토 배수 필수, 향기·당도 발현', climateNote: '남부 경사지 늦서리 회피 유리' },
    { name: '단감', base: 76, revenue: 4200, risk: 1, goodZones: ['warm_south'], goodSoils: ['loam','clay_loam'], maxSlope: 20, maxAlt: 250, desc: '경남·전남 남부 특산, 농협 단감 수매 안정 — 저장성 우수', soilNote: '양토·식양토 배수 양호 착색', climateNote: '겨울 최저기온 -5℃ 이상 지역 한정' },
    { name: '매실', base: 74, revenue: 4500, risk: 1, goodZones: ['warm_south'], goodSoils: ['loam','sandy'], maxSlope: 20, maxAlt: 300, desc: '남부 특산 가공원료, 농협 매실 계약재배 — 광양·순천 최대 산지', soilNote: '배수 양호 양토 과실 비대', climateNote: '남부 온난지 최적' },
    { name: '감귤', base: 88, revenue: 5800, risk: 2, goodZones: ['jeju','warm_south'], goodSoils: ['volcanic','loam'], maxSlope: 25, maxAlt: 200, desc: '제주·남해안 특산, 농협 감귤 수매 전담 체계 완비', soilNote: '화산회토 향미 극대화', climateNote: '겨울 최저기온 -3℃ 이상 필수' },
  ],
  // 시설: 하우스 작목만
  시설: [
    { name: '딸기', base: 90, revenue: 9800, risk: 2, goodZones: ['central','warm_south','warm_coast'], goodSoils: ['loam','clay_loam'], maxSlope: 3, maxAlt: 300, desc: '시설 대표 고소득, 농협 딸기 공동선별·수매 논산·담양 등 전국 체계', soilNote: '배수 양호 양토 당도·경도', climateNote: '중부 이남 연중 시설 재배' },
    { name: '토마토', base: 82, revenue: 7200, risk: 2, goodZones: ['central','warm_south','warm_coast'], goodSoils: ['loam','clay_loam'], maxSlope: 3, maxAlt: 300, desc: '연중 재배, 농협 공동출하·계약재배 — 스마트팜 전환 용이', soilNote: '수분 보유력 양토 과육 품질', climateNote: '시설 재배 지역 제한 적음' },
    { name: '파프리카', base: 82, revenue: 9500, risk: 3, goodZones: ['central','warm_south'], goodSoils: ['loam'], maxSlope: 3, maxAlt: 200, desc: '수출 농협 연계 고부가가치, 공동선별장 필요', soilNote: '수경 재배 병행 시 토양 의존 최소', climateNote: '항온 시설 재배 지역 영향 제한' },
    { name: '오이', base: 76, revenue: 5800, risk: 2, goodZones: ['central','warm_south'], goodSoils: ['loam','sandy'], maxSlope: 3, maxAlt: 300, desc: '회전 빠른 시설 과채, 단기 수익 — 농협 공동출하', soilNote: '통기성 양호 양토·사양토', climateNote: '중부 이남 시설 연중 가능' },
    { name: '멜론', base: 74, revenue: 6800, risk: 3, goodZones: ['warm_south','central'], goodSoils: ['loam','sandy'], maxSlope: 3, maxAlt: 200, desc: '고단가 시설 과채, 명절 선물 수요 집중', soilNote: '배수 양호 양토 당도', climateNote: '고온기 시설 온도 관리 핵심' },
    { name: '수박', base: 76, revenue: 5500, risk: 2, goodZones: ['warm_south','central','warm_coast'], goodSoils: ['sandy','loam'], maxSlope: 3, maxAlt: 250, desc: '시설·노지 겸용, 농협 수박 공동선별 — 부여·고창 주산지 체계', soilNote: '사질토·사양토 과즙·당도 최상', climateNote: '남부~중부 시설 재배 가능' },
  ],
  // 축산: 실제 한국 생산 조사료 + 주요 축종만
  축산: [
    { name: '이탈리안 라이그라스', base: 90, revenue: 900, risk: 1, goodZones: ['warm_south','central','warm_coast'], goodSoils: ['alluvial','loam','clay_loam'], maxSlope: 10, maxAlt: 400, desc: '국내 조사료 1위 — 축산 농협 수매 핵심, 논·밭 이모작 가능', soilNote: '충적토·양토 수량·품질 최상', climateNote: '중부 이남 동계 파종, 고랭지 춘파 가능' },
    { name: '옥수수(사일리지)', base: 86, revenue: 1200, risk: 1, goodZones: ['central','warm_south','highland'], goodSoils: ['loam','clay_loam'], maxSlope: 12, maxAlt: 500, desc: '사일리지 조사료, 국내 생산 2위 — 기계화·TDR 수분 관리 핵심', soilNote: '비옥한 양토 건물 수량 극대화', climateNote: '봄~여름 재배, 중부·고랭지 가능' },
    { name: '청보리', base: 84, revenue: 800, risk: 1, goodZones: ['warm_south','warm_coast','central'], goodSoils: ['loam','alluvial'], maxSlope: 10, maxAlt: 350, desc: '총체 사료 — 논·밭 답리작, 축산 농협 수매, 이탈리안 라이그라스와 이모작 경합', soilNote: '양토·충적토 총체 수량 높음', climateNote: '11월 파종, 5월 수확 — 중부 이남' },
    { name: '호밀', base: 78, revenue: 700, risk: 1, goodZones: ['central','warm_coast','highland'], goodSoils: ['loam','sandy','alluvial'], maxSlope: 12, maxAlt: 600, desc: '내한성 가장 강한 동계 조사료 — 중부·고랭지 논밭 이모작', soilNote: '사양토·양토 모두 적응, 토양 선택 적음', climateNote: '중부이북·고랭지 동계 재배 유일 대안' },
    { name: '수단그라스', base: 80, revenue: 900, risk: 1, goodZones: ['warm_south','central'], goodSoils: ['loam','sandy','alluvial'], maxSlope: 10, maxAlt: 400, desc: '하계 조사료 대표 — 생육 빠르고 수량 많아 여름철 청예 공급', soilNote: '양토·사양토 생육 왕성', climateNote: '5~9월 재배, 남부~중부 이모작 가능' },
    { name: '연맥(귀리)', base: 76, revenue: 750, risk: 1, goodZones: ['central','highland','warm_coast'], goodSoils: ['loam','sandy'], maxSlope: 10, maxAlt: 500, desc: '동계 조사료, 소화율 높아 젖소 선호 — 사료 품질 프리미엄', soilNote: '사양토·양토 적응, 배수 양호 필요', climateNote: '10월 파종, 5월 수확 — 중부 이남' },
    { name: '트리티케일', base: 74, revenue: 750, risk: 1, goodZones: ['central','highland'], goodSoils: ['loam','clay_loam'], maxSlope: 10, maxAlt: 500, desc: '밀×호밀 교잡 조사료 — 수량 많고 내한성 강해 중부 논 이모작 보급 확대 중', soilNote: '양토·식양토 수량 안정', climateNote: '중부이북 동계 재배 가능' },
    { name: '한우', base: 82, revenue: 0, risk: 2, goodZones: ['central','warm_south','highland'], goodSoils: ['loam','alluvial','clay_loam'], maxSlope: 20, maxAlt: 600, desc: '지역 브랜드 한우 농협 수매 — 조사료 자급 시 사료비 절감·경쟁력', soilNote: '조사료 재배 적지 겸용 검토', climateNote: '지역 한우 브랜드 있는 경우 우선 검토' },
    { name: '젖소', base: 74, revenue: 0, risk: 2, goodZones: ['central','highland'], goodSoils: ['loam','clay_loam'], maxSlope: 15, maxAlt: 500, desc: '원유 낙농 농협 수매 — 이탈리안 라이그라스·연맥 자급 시 경쟁력', soilNote: '목초·조사료 재배 적지 필요', climateNote: '고온 다습 남부보다 중부·고랭지 관리 유리' },
  ],
};

// 필지 종류 추론 — 논/밭/과수/시설/축산 엄격 분리
const PADDY_CROPS = ['벼','이탈리안 라이그라스','청보리','호밀','연맥','트리티케일','총체벼','미나리','연근'];
const ORCHARD_CROPS = ['사과','배','복숭아','포도','샤인머스캣','감귤','한라봉','천혜향','레드향','단감','자두','매실','살구','체리','대추','무화과','석류','유자','키위','블루베리','망고','곶감'];
const GREENHOUSE_CROPS = ['딸기','토마토','방울토마토','파프리카','피망','멜론','오이','화훼','수박'];
const LIVESTOCK_CROPS = ['한우','육우','젖소','돼지','흑돼지','산란계','육계','토종닭','오리','거위','염소','흑염소','산양','면양','사슴','말','꿀벌','수단그라스','연맥(귀리)','트리티케일','옥수수(사일리지)'];

function inferCat(crop: string, landType?: string | null): Cat {
  if (landType) {
    const map: Record<string, Cat> = { 논: '논', 밭: '밭', 과수: '과수', 시설: '시설', 축산: '축산', 목장: '축산' };
    if (map[landType]) return map[landType];
  }
  const c = crop.trim();
  if (PADDY_CROPS.includes(c)) return '논';
  if (ORCHARD_CROPS.includes(c)) return '과수';
  if (GREENHOUSE_CROPS.includes(c)) return '시설';
  if (LIVESTOCK_CROPS.includes(c) || c.includes('사일리지') || c.includes('조사료') || c.includes('목장') || c.includes('한우') || c.includes('젖소')) return '축산';
  return '밭';
}
const CAT_LABEL: Record<Cat, string> = { 논: '논(수도작·이모작)', 밭: '밭(노지)', 과수: '과수원', 시설: '시설하우스', 축산: '축산·조사료' };

function calcScore(c: CropDef, zone: ClimateZone, soil: SoilClass, slope: number, alt: number, specialty: boolean): number {
  let s = c.base;
  if (specialty) s += 8;
  if (c.goodZones.includes(zone)) s += 5; else s -= 8;
  if (c.goodSoils.includes(soil)) s += 4; else if (soil !== 'unknown') s -= 4;
  if (slope > c.maxSlope) s -= Math.min(15, (slope - c.maxSlope) * 1.5);
  if (alt > c.maxAlt) s -= Math.min(12, (alt - c.maxAlt) * 0.04);
  return Math.max(10, Math.min(99, Math.round(s)));
}

function buildReasons(c: CropDef, zone: ClimateZone, soil: SoilClass, slope: number, alt: number, sp: ReturnType<typeof getSpecialty>): string[] {
  const r: string[] = [c.desc];
  if (sp?.crops.includes(c.name)) r.push(`이 지역 조합 수매 작목 — ${sp.note}`);
  if (c.goodZones.includes(zone)) r.push(`${CLIMATE_LABEL[zone]} 기후권 — ${c.climateNote}`);
  else r.push(`이 기후권(${CLIMATE_LABEL[zone]})은 최적 재배지와 차이 있음 — 품종·작기 조정 필요`);
  if (soil !== 'unknown') {
    if (c.goodSoils.includes(soil)) r.push(`${SOIL_LABEL[soil]} — ${c.soilNote}`);
    else r.push(`현재 토양(${SOIL_LABEL[soil]})은 최적지와 다름 — 유기물 보충·배수 개선 검토`);
  }
  if (slope > c.maxSlope) r.push(`경사도 ${slope}° 권장 한계(${c.maxSlope}°) 초과 — 기계 작업 어려움`);
  if (alt > c.maxAlt) r.push(`표고 ${alt}m 적정 고도 초과 — 생육기간 단축 주의`);
  return r;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const currentCrop = (sp.get('currentCrop') ?? '').trim();
  const address = sp.get('address') ?? '';
  const altitude = Number(sp.get('altitude') ?? 0);
  const slope = Number(sp.get('slope') ?? 0);
  const soilLabel = sp.get('soil') ?? '';

  const cat = inferCat(currentCrop, sp.get('landType'));
  const zone = inferClimate(address, altitude);
  const soil = classifySoil(soilLabel);
  const specialty = getSpecialty(address);

  const list = CROPS[cat] ?? CROPS['밭'];
  const scored = list.map(c => ({
    ...c,
    isSpecialty: specialty?.crops.includes(c.name) ?? false,
    finalScore: calcScore(c, zone, soil, slope, altitude, specialty?.crops.includes(c.name) ?? false),
    reasons: buildReasons(c, zone, soil, slope, altitude, specialty),
    current: c.name === currentCrop,
  })).sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || b.finalScore - a.finalScore);

  const top4 = scored.slice(0, 4).map((c, i) => ({
    rank: i + 1, name: c.name + (c.current ? ' (현재)' : ''), current: c.current,
    score: c.finalScore, revenue: c.revenue > 0 ? `${c.revenue.toLocaleString()}k` : '—',
    risk: c.risk, reasons: c.reasons, isSpecialty: c.isSpecialty,
  }));

  const top = top4[0];
  const spNote = specialty ? ` | 지역 수매: ${specialty.crops.slice(0, 3).join('·')}` : '';
  const summary = `[${CAT_LABEL[cat]} · ${CLIMATE_LABEL[zone]} · ${SOIL_LABEL[soil]} · 경사 ${slopeGrade(slope)}${spNote}] '${top?.name.replace(' (현재)', '') ?? '—'}'(적합도 ${top?.score ?? 0}) 최우선 추천.`;

  return NextResponse.json({ model: 'farmu-suitability-v3(수매·이모작·조사료 현실화)', category: cat, zone, soil, specialty: specialty?.note ?? null, summary, crops: top4 });
}
