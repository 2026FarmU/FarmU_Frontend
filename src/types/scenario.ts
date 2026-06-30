export interface ScenarioSimulateRequest {
  memberId: string;
  landId: string;
  changes: {
    fromCrop: string;
    toCrop: string;
    applyAreaRatio: number;
    startPeriod: string;
  };
}

export interface ScenarioTimeline {
  period: string;
  score: number;
  revenue: number;
}

export interface ScenarioRisk {
  type: string;
  amount: number;
  note: string;
}

export interface ScenarioAiAdvice {
  summary: string;
  actions: string[];
  riskFactors: string[];
}

export interface ScenarioSimulateResponse {
  scenarioId: string;
  baseline: { score: number; annualRevenue: number };
  projected: { score: number; annualRevenue: number };
  delta: { scorePoint: number; revenue: number; revenuePct: number };
  timeline: ScenarioTimeline[];
  risks: ScenarioRisk[];
  confidence: number;
  aiAdvice?: ScenarioAiAdvice | null;
}

export interface ScenarioDetail {
  id: string;
  name: string;
  createdAt: string;
  params: {
    memberId: string;
    landId: string;
    fromCrop: string;
    toCrop: string;
    applyAreaRatio: number;
    startPeriod: string;
  };
  result: ScenarioSimulateResponse;
}
