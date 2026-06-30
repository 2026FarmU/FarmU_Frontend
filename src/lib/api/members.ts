import { apiClient } from './instance';
import type { MemberRankingResponse, MemberAnalysis } from '@/types/member';

// UNION_ADMIN 조합원 관리 페이지용
export interface MemberItem {
  userId: string;
  memberId?: string;
  name: string;
  loginId: string;
  status: 'ACTIVE' | 'INACTIVE';
  landCount?: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export const membersApi = {
  // 내 조합 조합원 목록 (관리 페이지 테이블용)
  list: () =>
    apiClient.get<{ data: MemberItem[] }>('/unions/members'),

  // 성과 랭킹 목록 (운영책임자 조합원 선택 드롭다운, 필지/시나리오 페이지)
  getRanking: (params: {
    unionId: string;
    period: string;
    group?: string;
    page?: number;
    size?: number;
  }) => apiClient.get<MemberRankingResponse>('/members/ranking', { params }),

  // 개별 조합원 분석 (내 분석 페이지)
  getAnalysis: (memberId: string, period: string) =>
    apiClient.get<{ data: MemberAnalysis }>(`/members/${memberId}/analysis`, {
      params: { period },
    }),
} as const;
