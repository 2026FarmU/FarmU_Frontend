export type MatchStatus = 'REQUESTED' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface MentorCandidate {
  mentorId: string;
  name: string;
  matchScore: number;
  matchReasons: string[];
  score: number;
  distanceKm: number;
}

export interface MentoringCandidatesResponse {
  data: MentorCandidate[];
}
export interface MatchRequest {
  mentorId: string;
  menteeId: string;
  goal: string;
}
export interface MatchResponse {
  matchId: string;
  status: MatchStatus;
}

export interface MatchTask {
  id: string;
  title: string;
  status: 'TODO' | 'DOING' | 'DONE';
  dueDate?: string;
  createdAt: string;
}

export interface MatchTasksResponse {
  data: MatchTask[];
}
export interface CreateTaskRequest {
  title: string;
  dueDate?: string;
}
