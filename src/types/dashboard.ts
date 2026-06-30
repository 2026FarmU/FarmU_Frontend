import type { PaginatedResponse } from './common';

export interface DashboardSummary {
  unionId: string;
  period: string;
  avgScore: number;
  scoreDelta: number;
  memberCount: number;
  // 백엔드 GroupDistributionResponse 와 동일 (top/mid/low)
  groupDistribution: { top: number; mid: number; low: number };
  kpi: { shippingHitRate: number; avgRevenue: number; reportTimeReduced: number };
  // 전월 대비 델타(옵셔널) — 백엔드 제공 시 KPI 카드에 ▲/▼ 표기. scoreDelta 와 동일 패턴.
  kpiDelta?: { shippingHitRate?: number; avgRevenue?: number; reportTimeReduced?: number };
  lastUpdated: string;
  availablePeriods: string[];
}

export interface TrendPoint {
  period: string;
  value: number;
}
// 다중 시리즈 (B-3): 그룹별 라인
export interface TrendSeries {
  group: 'avg' | 'top' | 'low';
  label: string;
  points: TrendPoint[];
}
export interface DashboardTrends {
  metric: string;
  series: TrendSeries[];
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
