import { apiClient } from './instance';
import type { MemberRankingResponse, MemberAnalysis } from '@/types/member';

export const membersApi = {
  getRanking: (params: {
    unionId: string;
    period: string;
    group?: string;
    page?: number;
    size?: number;
  }) => apiClient.get<MemberRankingResponse>('/members/ranking', { params }),

  getAnalysis: (memberId: string, period: string) =>
    apiClient.get<{ data: MemberAnalysis }>(`/members/${memberId}/analysis`, {
      params: { period },
    }),
} as const;
