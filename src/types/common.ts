// ─── 공통 응답 구조 ──────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface AsyncJobResponse {
  jobId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  estimatedSeconds: number;
  pollingUrl?: string;
}

// ─── 공통 에러 구조 (RFC 9457) ────────────────────────────────────────────────

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  properties: {
    timestamp: string;
    code: string;
  };
}
