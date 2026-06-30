import { apiClient } from './instance';

export interface DataUploadItem {
  uploadId: string;
  filename: string;
  contentType: string;
  size: number;
  status: 'VALIDATING' | 'VALIDATED' | 'APPLIED' | 'FAILED';
  totalRows: number;
  errorCount: number;
  valid: boolean;
  createdAt: string;
}

export const dataApi = {
  history: (params?: { page?: number; size?: number }) =>
    apiClient.get<{ data: DataUploadItem[] }>('/data/uploads', { params }),

  directUpload: (file: File, dataType: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('dataType', dataType);
    return apiClient.post<{ data: DataUploadItem }>('/data/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  apply: (uploadId: string, body: { skipErrors: boolean; applyWarnings: boolean }) =>
    apiClient.post<{ data: { uploadId: string; appliedAt: string } }>(`/data/uploads/${uploadId}/apply`, body),
  aiDraft: (body: { dataType: string; period: string }) =>
    apiClient.post<{ data: { uploadId: string; status: string; rows: unknown[] } }>('/data/ai-draft', body),
} as const;
