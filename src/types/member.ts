export interface MemberRankingItem {
  rank: number;
  memberId: string;
  name: string;
  mainCrop: string;
  region: string;
  totalScore: number;
  group: 'TOP' | 'MID' | 'LOW';
  scoreChange: number;
}

export interface MemberRankingResponse {
  data: MemberRankingItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  availablePeriods: string[];
}

export interface MemberAnalysis {
  memberId: string;
  name: string;
  crop: string;
  region: string;
  years: number;
  period: string;
  totalScore: number;
  scoreDelta: number;
  rank: number;
  rankTotal: number;
  group: 'TOP' | 'MID' | 'LOW';
  shippingHitRate: number;
  shippingHitRateDelta?: number | null;
  baseline: number;
  components: {
    production: { value: number; percentile?: number };
    shipping: { value: number; percentile?: number };
    revenue: { value: number; percentile?: number };
    quality: { value: number; percentile?: number };
    costEfficiency: { value: number; percentile?: number };
  };
  scoreHistory: Array<{ period: string; score: number }>;
  cropSuitability: Array<{ crop: string; fitScore: number; current?: boolean }>;
  xaiFactors: Array<{ factor: string; contribution: number }>;
  improvementTasks: Array<{
    category: string;
    title: string;
    description: string;
    expectedImpact: { scoreDelta: number };
  }>;
  availablePeriods: string[];
  model: string;
  generatedAt: string;
}
