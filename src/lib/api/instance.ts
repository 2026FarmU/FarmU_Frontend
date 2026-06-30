import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { persistTokens, clearTokens } from '@/lib/auth/session';
import { useAuthStore } from '@/lib/store/authStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://farmu.gbsw.hs.kr';

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ─── Request Interceptor ────────────────────────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    const unionId = localStorage.getItem('activeUnionId');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (unionId) {
      config.headers['X-Union-Id'] = unionId;
    }
  }
  return config;
});

// ─── Response Interceptor (401 토큰 갱신) ───────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
};

const isAuthExpiredError = (error: AxiosError): boolean =>
  error.response?.status === 401;

// 인증 엔드포인트 — 여기서의 실패(로그인 실패 401 등)는 세션 만료가 아니라 자격 오류이므로
// 토큰 갱신/리다이렉트 대상에서 제외하고 호출부(로그인 페이지 등)로 그대로 전달한다.
const isAuthEndpoint = (url?: string): boolean =>
  !!url && /\/auth\/(login|refresh|register)/.test(url);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (isAuthEndpoint(originalRequest?.url)) {
      return Promise.reject(error);
    }

    if (isAuthExpiredError(error) && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken });
        const newAccessToken: string = data.data.accessToken;
        const newRefreshToken: string | undefined = data.data.refreshToken;

        // flat 키 + 쿠키(미들웨어용) + zustand 스토어를 모두 갱신해 상태 어긋남 방지
        persistTokens(newAccessToken, newRefreshToken);
        useAuthStore.getState().updateTokens(newAccessToken, newRefreshToken ?? refreshToken ?? '');
        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // 세션 만료 — flat 키·쿠키·스토어를 함께 정리해 "토큰 없는데 로그인 상태" 한계 상태 방지
        clearTokens();
        useAuthStore.getState().clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
