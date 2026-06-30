import type { PaginatedResponse } from './common';

// 백엔드 실측(2026-06-17): type enum = UNION | MONTHLY | MEMBER (명세서의 UNION_MONTHLY/MEMBER_ACTION는 구버전)
export type ReportType = 'UNION' | 'MONTHLY' | 'MEMBER';
export type ReportFormat = 'PDF' | 'XLSX';
// 리스트 상태: 완료=READY (COMPLETED는 /reports/generate 응답 jobStatus 전용)
export type ReportListStatus = 'PROCESSING' | 'READY' | 'FAILED';
export type ReportStatus = ReportListStatus | 'COMPLETED';

export interface ReportGenerateRequest {
  type: ReportType;
  unionId?: string;
  memberId?: string;
  period: string;
  format: ReportFormat;
  sections?: string[];
  force?: boolean;
}

export interface ReportGenerateResponse {
  jobId: string;
  status: ReportStatus;
  estimatedSeconds: number;
  pollingUrl?: string;
}

export interface ReportDetail {
  reportId?: string;
  id?: string;
  type: ReportType;
  status: ReportStatus;
  format: ReportFormat;
  period?: string;
  downloadUrl?: string;
  expiresAt?: string;
  fileSize?: number;
  createdAt: string;
  // AI-2 LLM 생성 결과
  title?: string;
  content?: string; // 마크다운 자연어 본문
  model?: string;
  generatedAt?: string;
}

// 백엔드 ReportResponse 와 동일
export interface ReportListItem {
  reportId: string;
  memberId?: string | null;
  type: ReportType;
  period: string;
  format: ReportFormat;
  sections?: string[];
  status: ReportListStatus;
  downloadUrl?: string;
  downloadUrlExpiresAt?: string;
  createdAt: string;
}
export type ReportListResponse = PaginatedResponse<ReportListItem>;
