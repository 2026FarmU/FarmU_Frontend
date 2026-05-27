import type { PaginatedResponse } from './common';

export type MemberGroup = 'TOP' | 'MIDDLE' | 'NEEDS_IMPROVEMENT';

export interface MemberRankItem {
  memberId: string;
  rank: number;
  name: string;
  group: MemberGroup;
  score: number;
  scoreDelta: number;
  components: { production: number; shipping: number; revenue: number };
  mainCrop: string;
  region: string;
}

export type MemberRankingResponse = PaginatedResponse<MemberRankItem>;

export interface XaiFactorItem {
  factor: string;
  contribution: number;
  direction: 'positive' | 'negative';
  description: string;
}

export interface ImprovementTask {
  taskId: string;
  priority: number;
  title: string;
  category: 'SHIPPING' | 'PRODUCTION' | 'CROP_CHANGE';
  expectedImpact: { scoreDelta: number; revenueDelta: number };
}

export interface MemberAnalysis {
  memberId: string;
  period: string;
  totalScore: number;
  components: {
    production: { score: number; weight: number; percentile: number };
    shipping: { score: number; weight: number; percentile: number };
    revenue: { score: number; weight: number; percentile: number };
  };
  xaiFactors: XaiFactorItem[];
  improvementTasks: ImprovementTask[];
}
