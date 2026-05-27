import { apiClient } from './instance';
import type {
  ReportGenerateRequest,
  ReportGenerateResponse,
  ReportDetail,
  ReportListResponse,
} from '@/types/report';

export const reportsApi = {
  generate: (body: ReportGenerateRequest) =>
    apiClient.post<{ data: ReportGenerateResponse }>('/reports/generate', body),

  getStatus: (reportId: string) => apiClient.get<{ data: ReportDetail }>(`/reports/${reportId}`),

  getList: (params: { unionId?: string; type?: string; page?: number; size?: number }) =>
    apiClient.get<ReportListResponse>('/reports', { params }),
} as const;
