import { apiClient } from './instance';

export interface Weights {
  production: number;
  shipping: number;
  revenue: number;
  updatedAt?: string;
}

export const settingsApi = {
  getWeights: () => apiClient.get<{ data: Weights }>('/settings/weights'),
  updateWeights: (body: { production: number; shipping: number; revenue: number }) =>
    apiClient.patch('/settings/weights', body),
} as const;
