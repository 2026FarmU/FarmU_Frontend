import { apiClient } from './instance';
import type {
  MentoringCandidatesResponse,
  MatchRequest,
  MatchResponse,
  MatchTasksResponse,
  CreateTaskRequest,
} from '@/types/mentoring';

export const mentoringApi = {
  getSuggestions: (menteeId: string) =>
    apiClient.get<MentoringCandidatesResponse>('/mentoring/suggestions', {
      params: { menteeId },
    }),

  requestMatch: (body: MatchRequest) =>
    apiClient.post<{ data: MatchResponse }>('/mentoring/matches', body),

  approveMatch: (matchId: string) => apiClient.patch(`/mentoring/matches/${matchId}/approve`),

  rejectMatch: (matchId: string, reason: string) =>
    apiClient.patch(`/mentoring/matches/${matchId}/reject`, { reason }),

  getTasks: (matchId: string) =>
    apiClient.get<MatchTasksResponse>(`/mentoring/matches/${matchId}/tasks`),

  createTask: (matchId: string, body: CreateTaskRequest) =>
    apiClient.post(`/mentoring/matches/${matchId}/tasks`, body),

  updateTaskStatus: (matchId: string, taskId: string, status: string) =>
    apiClient.patch(`/mentoring/matches/${matchId}/tasks/${taskId}`, { status }),
} as const;
