import { QueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { ApiError } from '@/types/common';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분
      gcTime: 1000 * 60 * 10, // 10분
      retry: (failureCount, error) => {
        const axiosError = error as AxiosError<ApiError>;
        const status = axiosError?.response?.status;
        // 4xx 에러는 재시도 안 함
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
