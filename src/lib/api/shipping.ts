import { apiClient } from './instance';
import type {
  ShippingRecommendationsResponse,
  ShippingDecisionRequest,
  ShippingAccuracyResponse,
} from '@/types/shipping';

export const shippingApi = {
  getRecommendations: (params: { unionId?: string; memberId?: string; status?: string }) =>
    apiClient.get<ShippingRecommendationsResponse>('/shipping/recommendations', { params }),

  submitDecision: (id: string, body: ShippingDecisionRequest) =>
    apiClient.post(`/shipping/recommendations/${id}/decision`, body),

  getAccuracy: (params: { unionId: string; from: string; to: string }) =>
    apiClient.get<{ data: ShippingAccuracyResponse }>('/shipping/accuracy', { params }),

  registerLivestock: (body: {
    livestockId: string;
    currentWeight: number;
    targetWeight: number;
    baseRevenue: number;
    memberId?: string;
    observedAt?: string;
  }) => apiClient.post<{ data: { livestockRecordId: string; recommendation: import('@/types/shipping').ShippingRecommendation } }>('/livestock', body),
} as const;
