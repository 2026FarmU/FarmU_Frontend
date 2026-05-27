export interface ScenarioSimulateRequest {
  memberId: string;
  landId: string;
  changes: { fromCrop: string; toCrop: string; applyAreaRatio: number; startPeriod: string };
}

export interface TimelinePoint {
  period: string;
  score: number;
  revenue: number;
}
export interface ScenarioRisk {
  type: string;
  amount: number;
  note?: string;
}

export interface ScenarioSimulateResponse {
  scenarioId: string;
  baseline: { score: number; annualRevenue: number };
  projected: { score: number; annualRevenue: number };
  delta: { scorePoint: number; revenue: number; revenuePct: number };
  timeline: TimelinePoint[];
  risks: ScenarioRisk[];
  confidence: number;
}

export interface ScenarioListItem {
  id: string;
  name: string;
  createdAt: string;
}
export interface ScenarioListResponse {
  data: ScenarioListItem[];
}
