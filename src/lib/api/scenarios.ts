import { apiClient } from './instance';
import type { ScenarioSimulateRequest, ScenarioSimulateResponse, ScenarioDetail } from '@/types/scenario';

export interface SavedScenario {
  scenarioId: string;
  name: string;
  createdAt: string;
}

export const scenariosApi = {
  simulate: (body: ScenarioSimulateRequest) =>
    apiClient.post<{ data: ScenarioSimulateResponse }>('/scenarios/simulate', body),

  save: (body: { scenarioId: string; name: string }) =>
    apiClient.post<{ data: { scenarioId: string } }>('/scenarios', body),

  list: (params?: { memberId?: string; size?: number }) =>
    apiClient.get<{ data: SavedScenario[] }>('/scenarios', { params }),

  get: (scenarioId: string) =>
    apiClient.get<{ data: ScenarioDetail }>(`/scenarios/${scenarioId}`),

  propose: (scenarioId: string, body: { targetMemberId: string; message: string }) =>
    apiClient.post<{ data: { scenarioId: string; status: string } }>(
      `/scenarios/${scenarioId}/propose`,
      body,
    ),

  remove: (scenarioId: string) => apiClient.delete(`/scenarios/${scenarioId}`),
} as const;
