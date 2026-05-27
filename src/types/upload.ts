import type { PaginatedResponse } from './common';

export type DataType = 'MEMBER_PERFORMANCE' | 'SHIPPING_HISTORY' | 'LIVESTOCK' | 'SALES' | 'LAND';
export type UploadStatus =
  | 'PENDING'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'VALIDATED_WITH_ERRORS'
  | 'APPLIED'
  | 'FAILED';

export interface UploadUrlRequest {
  fileName: string;
  dataType: DataType;
  size: number;
}
export interface UploadUrlResponse {
  uploadId: string;
  uploadUrl: string;
  expiresIn: number;
}

export interface ValidationIssue {
  row: number;
  column: string;
  value: string;
  code: string;
  message: string;
}

export interface UploadValidationResponse {
  uploadId: string;
  status: UploadStatus;
  summary: { totalRows: number; validRows: number; errorRows: number; warningRows: number };
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface UploadListItem {
  id: string;
  fileName: string;
  dataType: DataType;
  status: UploadStatus;
  uploadedBy: string;
  createdAt: string;
}
export type UploadListResponse = PaginatedResponse<UploadListItem>;
