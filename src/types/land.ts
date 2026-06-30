export interface LandGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

// 백엔드 LandItem 과 동일 (GET /lands)
export interface Land {
  landId: string;
  memberId: string;
  name: string;
  pnu: string;
  address: string;
  latitude: number;
  longitude: number;
  area: number;
  mainCrop: string;
  headCount?: number | null; // 축산 필지 두수 (마리)
}

export interface LandsResponse {
  data: Land[];
}

// 사용자 필지 직접 등록 요청 (POST /lands)
export interface LandCreateRequest {
  name: string;
  pnu: string;
  address: string;
  latitude: number;
  longitude: number;
  area: number; // m²
  mainCrop: string;
  headCount?: number | null; // 축산 필지 두수 (마리)
  memberId?: string; // 운영책임자가 조합원 대신 등록 시
}

// 백엔드 AI-1 적합도 실제 응답 (공공데이터 기반)
export interface CropCandidate {
  crop: string;
  score?: number;
  suitabilityScore: number;
  rank: number;
  factors?: { soil: number; climate: number; slope: number; sunlight: number };
  riskFactors?: Array<{ type: string; score?: number; level?: string; note?: string }>;
  expectedRevenuePerHa?: number;
  marketPrice?: number;
  estimatedYield?: number;
  reasons?: string[];
}

export type LandSuitabilityCandidate = CropCandidate;

export interface LandSuitability {
  landId: string;
  currentCrop?: string;
  currentCropScore?: number;
  candidates: CropCandidate[];
  model?: string;
  generatedAt?: string;
}
