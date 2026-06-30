import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me().then((r) => r.data.data),
    staleTime: 1000 * 60 * 5, // 5분 캐시
    retry: false,
  });
}
