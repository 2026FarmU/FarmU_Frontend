import { apiClient } from './instance';
import type {
  UploadUrlRequest,
  UploadUrlResponse,
  UploadValidationResponse,
  UploadListResponse,
} from '@/types/upload';

export const dataApi = {
  getUploadUrl: (body: UploadUrlRequest) =>
    apiClient.post<{ data: UploadUrlResponse }>('/data/uploads', body),

  commit: (uploadId: string) => apiClient.post(`/data/uploads/${uploadId}/commit`),

  getValidation: (uploadId: string) =>
    apiClient.get<{ data: UploadValidationResponse }>(`/data/uploads/${uploadId}/validation`),

  patchRow: (uploadId: string, row: number, body: { column: string; value: string }) =>
    apiClient.patch(`/data/uploads/${uploadId}/rows/${row}`, body),

  revalidate: (uploadId: string) => apiClient.post(`/data/uploads/${uploadId}/revalidate`),

  apply: (uploadId: string, body: { skipErrors: boolean; applyWarnings: boolean }) =>
    apiClient.post(`/data/uploads/${uploadId}/apply`, body),

  getList: (params: {
    unionId?: string;
    dataType?: string;
    status?: string;
    page?: number;
    size?: number;
  }) => apiClient.get<UploadListResponse>('/data/uploads', { params }),
} as const;
