import { apiClient } from './instance';
import type {
  MentoringCandidatesResponse,
  MatchDetailResponse,
  MatchRequest,
  MatchResponse,
  MatchTasksResponse,
  MatchTask,
  CreateTaskRequest,
  MentoringStats,
  MatchListItem,
} from '@/types/mentoring';

export const mentoringApi = {
  getSuggestions: (params: { menteeId: string; size?: number }) =>
    apiClient.get<MentoringCandidatesResponse>('/mentoring/suggestions', {
      params,
    }),

  getStats: () => apiClient.get<{ data: MentoringStats }>('/mentoring/stats'),

  getMatches: (params?: { status?: string; page?: number; size?: number }) =>
    apiClient.get<{ data: MatchListItem[] }>('/mentoring/matches', { params }),

  // 매칭 상세 조회 — 추천 카드 "상세" 진입
  getSuggestionDetail: (mentorId: string, menteeId: string) =>
    apiClient.get<MatchDetailResponse>(`/mentoring/suggestions/${mentorId}`, {
      params: { menteeId },
    }),

  requestMatch: (body: MatchRequest) =>
    apiClient.post<{ data: MatchResponse }>('/mentoring/matches', body),

  approveMatch: (matchId: string) => apiClient.patch(`/mentoring/matches/${matchId}/approve`),

  rejectMatch: (matchId: string) => apiClient.patch(`/mentoring/matches/${matchId}/reject`),

  cancelMatch: (matchId: string) => apiClient.delete(`/mentoring/matches/${matchId}`),

  getTasks: (matchId: string) =>
    apiClient.get<MatchTasksResponse>(`/mentoring/matches/${matchId}/tasks`),

  createTask: (matchId: string, body: CreateTaskRequest) =>
    apiClient.post<{ data: MatchTask }>(`/mentoring/matches/${matchId}/tasks`, body),

  // PATCH /mentoring/matches/{id}/tasks/{taskId} — MentoringTaskPatch(title/description/dueDate/completed)
  updateTask: (matchId: string, taskId: string, body: Partial<Pick<MatchTask, 'title' | 'description' | 'dueDate' | 'completed'>>) =>
    apiClient.patch<{ data: MatchTask }>(`/mentoring/matches/${matchId}/tasks/${taskId}`, body),
} as const;
