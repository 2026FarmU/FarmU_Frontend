export type ShippingAction = 'SHIP' | 'HOLD' | 'SPLIT_SHIP' | 'REVIEW';

export interface RiskFactor {
  type: string;
  score: number;
  note?: string;
}

export interface ShippingRecommendation {
  id: string;
  memberId: string;
  livestockId: string;
  currentWeight: number;
  targetWeight: number;
  recommendedDate: string;
  recommendedAction: ShippingAction;
  confidence: number;
  expectedRevenue: { min: number; expected: number; max: number };
  riskFactors: RiskFactor[];
  rationale: string;
  /** 결정 상태 (B-14). 백엔드 미제공 시 undefined → PENDING으로 간주 */
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  decidedAt?: string | null;
}

export interface ShippingRecommendationsResponse {
  data: ShippingRecommendation[];
}

export interface ShippingDecisionRequest {
  decision: 'ACCEPTED' | 'REJECTED';
  actualShipDate?: string;
  memo?: string;
}

export interface MonthlyAccuracy {
  period: string;
  totalRecommendations: number;
  accepted: number;
  hitRate: number;
}
export interface ShippingAccuracyResponse {
  overallHitRate: number;
  monthly: MonthlyAccuracy[];
}
