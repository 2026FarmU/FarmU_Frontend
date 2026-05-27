import type { PaginatedResponse } from './common';

export type ReportType = 'UNION_MONTHLY' | 'MEMBER_ACTION';
export type ReportFormat = 'PDF' | 'XLSX';
export type ReportStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ReportGenerateRequest {
  type: ReportType;
  unionId?: string;
  memberId?: string;
  period: string;
  format: ReportFormat;
  sections?: string[];
}

export interface ReportGenerateResponse {
  reportId: string;
  status: ReportStatus;
  estimatedSeconds: number;
}

export interface ReportDetail {
  id: string;
  type: ReportType;
  status: ReportStatus;
  format: ReportFormat;
  downloadUrl?: string;
  expiresAt?: string;
  fileSize?: number;
  createdAt: string;
}

export interface ReportListItem {
  id: string;
  type: ReportType;
  period: string;
  format: ReportFormat;
  status: ReportStatus;
  createdAt: string;
}
export type ReportListResponse = PaginatedResponse<ReportListItem>;
