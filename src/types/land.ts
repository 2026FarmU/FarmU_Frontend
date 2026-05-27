export interface LandGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface Land {
  id: string;
  pnu: string;
  areaM2: number;
  geometry: LandGeometry;
  currentCrop: string;
  soilType: string;
  slope: number;
  elevation: number;
}

export interface LandsResponse {
  data: Land[];
}

export interface CropCandidate {
  cropCode: string;
  cropName: string;
  suitabilityScore: number;
  rank: number;
  factors: { soil: number; climate: number; slope: number; sunlight: number };
  riskFactors: Array<{ type: string; level: 'LOW' | 'MEDIUM' | 'HIGH'; note?: string }>;
  expectedRevenuePerHa: number;
}

export interface LandSuitability {
  landId: string;
  currentCropScore: number;
  candidates: CropCandidate[];
}
