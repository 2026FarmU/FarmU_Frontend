// ─── 성과율 그룹 ─────────────────────────────────────────────────────────────
export const MEMBER_GROUP_LABELS = {
  TOP: '상위',
  MIDDLE: '중위',
  NEEDS_IMPROVEMENT: '개선필요',
} as const;

export const MEMBER_GROUP_COLORS = {
  TOP: 'text-green-600 bg-green-50',
  MIDDLE: 'text-blue-600 bg-blue-50',
  NEEDS_IMPROVEMENT: 'text-red-600 bg-red-50',
} as const;

// ─── 위험 알림 ───────────────────────────────────────────────────────────────
export const ALERT_LEVEL_COLORS = {
  HIGH: 'text-red-600 bg-red-50 border-red-200',
  MEDIUM: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  LOW: 'text-blue-600 bg-blue-50 border-blue-200',
} as const;

export const ALERT_TYPE_LABELS = {
  PRICE_DROP: '가격 하락',
  WEATHER: '기상 위험',
  SUPPLY_SHOCK: '수급 충격',
  SHIPPING_WINDOW: '출하 적기',
} as const;

// ─── 출하 추천 ───────────────────────────────────────────────────────────────
export const SHIPPING_ACTION_LABELS = {
  SHIP: '출하 권고',
  HOLD: '출하 보류',
  SPLIT_SHIP: '분할 출하',
  REVIEW: '재검토',
} as const;

// ─── 리포트 ─────────────────────────────────────────────────────────────────
export const REPORT_TYPE_LABELS = {
  UNION_MONTHLY: '조합 월간 리포트',
  MEMBER_ACTION: '조합원 액션플랜',
} as const;

export const REPORT_STATUS_LABELS = {
  PROCESSING: '생성 중',
  COMPLETED: '완료',
  FAILED: '실패',
} as const;

// ─── 업로드 데이터 유형 ───────────────────────────────────────────────────────
export const DATA_TYPE_LABELS = {
  MEMBER_PERFORMANCE: '조합원 성과',
  SHIPPING_HISTORY: '출하 이력',
  LIVESTOCK: '가축 정보',
  SALES: '판매 정보',
  LAND: '필지 정보',
} as const;

// ─── 페이지네이션 기본값 ──────────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
