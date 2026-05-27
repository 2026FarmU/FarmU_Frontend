import type { PaginatedResponse } from './common';

export interface DashboardSummary {
  unionId: string;
  period: string;
  avgScore: number;
  scoreDelta: number;
  memberCount: number;
  groupDistribution: { top: number; middle: number; needsImprovement: number };
  kpi: { shippingHitRate: number; avgRevenue: number; reportTimeReduced: number };
  lastUpdated: string;
}

export interface TrendPoint {
  period: string;
  value: number;
}
export interface DashboardTrends {
  metric: string;
  series: TrendPoint[];
}

export type AlertLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertType = 'PRICE_DROP' | 'WEATHER' | 'SUPPLY_SHOCK' | 'SHIPPING_WINDOW';

export interface Alert {
  id: string;
  level: AlertLevel;
  type: AlertType;
  title: string;
  message: string;
  affectedMembers: number;
  createdAt: string;
  actionUrl?: string;
}

export type AlertsResponse = PaginatedResponse<Alert>;
