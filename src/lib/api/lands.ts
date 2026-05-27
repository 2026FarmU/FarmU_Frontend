import { apiClient } from './instance';
import type { LandsResponse, LandSuitability } from '@/types/land';

export const landsApi = {
  getByMember: (memberId: string) =>
    apiClient.get<LandsResponse>('/lands', { params: { memberId } }),

  getSuitability: (landId: string) =>
    apiClient.get<{ data: LandSuitability }>(`/lands/${landId}/suitability`),
} as const;
