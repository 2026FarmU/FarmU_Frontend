import { apiClient } from './instance';
import type {
  ScenarioSimulateRequest,
  ScenarioSimulateResponse,
  ScenarioListResponse,
} from '@/types/scenario';

export const scenariosApi = {
  simulate: (body: ScenarioSimulateRequest) =>
    apiClient.post<{ data: ScenarioSimulateResponse }>('/scenarios/simulate', body),

  save: (body: { scenarioId: string; name: string }) => apiClient.post('/scenarios', body),

  getList: (memberId: string) =>
    apiClient.get<ScenarioListResponse>('/scenarios', { params: { memberId } }),

  delete: (scenarioId: string) => apiClient.delete(`/scenarios/${scenarioId}`),
} as const;
