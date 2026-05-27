import { apiClient } from './instance';
import type { DashboardSummary, DashboardTrends, AlertsResponse } from '@/types/dashboard';

export const dashboardApi = {
  getSummary: (params: { unionId: string; period: string }) =>
    apiClient.get<{ data: DashboardSummary }>('/dashboard/summary', { params }),

  getTrends: (params: { unionId: string; from: string; to: string; metric: string }) =>
    apiClient.get<{ data: DashboardTrends }>('/dashboard/trends', { params }),

  getAlerts: (params: {
    unionId: string;
    level?: string;
    status?: string;
    page?: number;
    size?: number;
  }) => apiClient.get<AlertsResponse>('/dashboard/alerts', { params }),

  dismissAlert: (alertId: string) =>
    apiClient.patch(`/dashboard/alerts/${alertId}`, { status: 'DISMISSED' }),
} as const;
