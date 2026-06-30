import { apiClient } from './instance';

export interface SearchResult {
  type: string; // MEMBER | REPORT | LAND | ...
  id: string;
  title: string;
  description: string;
  actionUrl: string;
}

export const searchApi = {
  search: (q: string, size = 8) =>
    apiClient.get<{ data: SearchResult[] }>('/search', { params: { q, size } }),
} as const;
