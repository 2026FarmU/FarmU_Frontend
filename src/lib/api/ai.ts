import { apiClient } from './instance';

export interface AiStatus {
  provider: string;
  model: string;
  configured: boolean;
}

export const aiApi = {
  status: () => apiClient.get<{ data: AiStatus }>('/ai/status'),
  // 일반 농업 상담 (topic/question 기반)
  advice: (body: { topic: string; question: string; crop?: string; region?: string; context?: Record<string, unknown> }) =>
    apiClient.post<{ data: { summary: string; actions: string[]; riskFactors: string[] } }>('/ai/advice', body),
} as const;
