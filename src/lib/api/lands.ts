import { apiClient } from './instance';
import type { LandsResponse, LandSuitability, LandCreateRequest } from '@/types/land';

export interface LandItem {
  landId: string;
  memberId: string | null;
  name: string;
  pnu: string;
  address: string;
  latitude: number;
  longitude: number;
  area: number;
  mainCrop: string;
  headCount?: number | null;
}

export interface CreateLandBody {
  name: string;
  pnu: string;
  address: string;
  latitude: number;
  longitude: number;
  area: number;
  mainCrop?: string | null;
  headCount?: number | null;
  memberId?: string | null;
}

export const landsApi = {
  // 멤버 ID 기준 필지 조회 (시나리오 페이지, 지도 페이지 공용)
  getByMember: (memberId?: string) =>
    apiClient.get<LandsResponse>('/lands', { params: memberId ? { memberId } : {} }),

  // 검색·페이징 포함 목록 조회 (필지 관리 테이블용)
  getList: (params?: { memberId?: string; query?: string; page?: number; size?: number }) =>
    apiClient.get<{ data: LandItem[]; totalElements: number; hasNext: boolean }>('/lands', { params }),

  getSuitability: (landId: string) =>
    apiClient.get<{ data: LandSuitability }>(`/lands/${landId}/suitability`),

  create: (body: LandCreateRequest | CreateLandBody) =>
    apiClient.post<{ data: LandItem }>('/lands', body),

  remove: (landId: string) =>
    apiClient.delete(`/lands/${landId}`),

  delete: (landId: string) =>
    apiClient.delete(`/lands/${landId}`),
} as const;
