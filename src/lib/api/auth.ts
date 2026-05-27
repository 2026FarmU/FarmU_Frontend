import { apiClient } from './instance';
import type { LoginRequest, LoginResponse, RefreshResponse, MeResponse } from '@/types/auth';

export const authApi = {
  login: (body: LoginRequest) => apiClient.post<{ data: LoginResponse }>('/auth/login', body),

  refresh: (refreshToken: string) =>
    apiClient.post<{ data: RefreshResponse }>('/auth/refresh', { refreshToken }),

  logout: () => apiClient.post('/auth/logout'),

  me: () => apiClient.get<{ data: MeResponse }>('/auth/me'),
} as const;
