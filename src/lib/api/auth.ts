import { apiClient } from './instance';
import type { LoginRequest, LoginResponse, RefreshResponse, MeResponse } from '@/types/auth';

export const authApi = {
  login: (body: LoginRequest) => apiClient.post<{ data: LoginResponse }>('/auth/login', body),

  // 운영 책임자가 조합원 계정 발급 (회원가입 없음 → 관리자 생성). 역할은 항상 MEMBER.
  register: (body: { loginId: string; password: string; name: string; unionCode: string }) =>
    apiClient.post<{ data: { userId: string } }>('/auth/register', body),

  refresh: (refreshToken: string) =>
    apiClient.post<{ data: RefreshResponse }>('/auth/refresh', { refreshToken }),

  logout: () => apiClient.post('/auth/logout'),

  me: () => apiClient.get<{ data: MeResponse }>('/auth/me'),
} as const;
