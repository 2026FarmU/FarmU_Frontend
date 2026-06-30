import { apiClient } from './instance';

export interface DashboardSummary {
  avgScore: number;
  scoreDelta: number;
  kpi: { shippingHitRate: number; avgRevenue: number; reportTimeReduced: number };
  kpiDelta: { shippingHitRate: number; avgRevenue: number; reportTimeReduced: number };
  groupDistribution: { top: number; mid: number; low: number };
  memberCount: number;
  availablePeriods: string[];
}

export interface DashboardAlert {
  id: string;
  level: string;
  title: string;
  message: string;
  affectedMembers: number;
  createdAt: string;
}

export interface DashboardTrends {
  series: Array<{ group: string; points: Array<{ period: string; value: number }> }>;
}

export const dashboardApi = {
  getSummary: (params: { unionId: string; period: string }) =>
    apiClient.get<{ data: DashboardSummary }>('/dashboard/summary', { params }),
  getAlerts: (params: { unionId: string }) =>
    apiClient.get<{ data: DashboardAlert[] }>('/dashboard/alerts', { params }),
  getTrends: (params: { unionId: string; from: string; to: string; metric: string }) =>
    apiClient.get<{ data: DashboardTrends }>('/dashboard/trends', { params }),
  dismissAlert: (id: string) =>
    apiClient.post(`/dashboard/alerts/${id}/dismiss`),
} as const;
