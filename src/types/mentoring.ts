export type MatchStatus = 'PENDING' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED';

export interface MentoringStats {
  active: number;
  completed: number;
  pending: number;
  availableMentors: number;
}

// GET /mentoring/matches 의 항목
export interface MatchListItem {
  matchId: string;
  mentorId: string;
  mentorName: string;
  mentorCrop?: string;
  mentorRegion?: string;
  menteeId: string;
  menteeName: string;
  goal: string | null;
  helpAreas: string[];
  status: string;
  taskCount: number;
  completedTaskCount: number;
  createdAt: string;
}

// 백엔드 MentorSuggestion 과 동일 (경축=crop, 멘토 성과율=mentorScore)
export interface MentorCandidate {
  mentorId: string;
  name: string;
  crop: string;
  region: string;
  mentorScore: number; // 멘토 본인 성과율 (0~100)
  matchScore: number; // 매칭 점수 (%, 0~100)
  helpAreas: string[];
  matchReasons: string[];
  distanceKm: number;
}

export interface MentoringCandidatesResponse {
  data: MentorCandidate[];
}

// 매칭 상세 조회 (GET /mentoring/suggestions/{mentorId}?menteeId=)
// 백엔드 실제 필드명: 경축=crop, 멘토성과율=mentorScore
export interface MatchDetail {
  mentorId: string;
  name: string;
  crop: string;
  years: number;
  region: string;
  distanceKm: number;
  mentorScore: number; // 멘토 성과율 (0~100)
  matchScore: number; // 매칭 점수 (%, 0~100)
  reason: string;
  tags: string[];
  matchFactors: Array<{ factor: string; score: number }>;
  comparison: Array<{ category: string; menteeScore: number; mentorScore: number }>;
  helpAreas: Array<{ category: string; title: string; description: string }>;
}

export interface MatchDetailResponse {
  data: MatchDetail;
}
export interface MatchRequest {
  mentorId: string;
  menteeId: string;
  goal: string;
  helpAreas?: string[];
}
export interface MatchResponse {
  matchId: string;
  status: MatchStatus;
}

// 백엔드 MentoringTaskResponse 와 동일
export interface MatchTask {
  taskId: string;
  matchId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
}

export interface MatchTasksResponse {
  data: MatchTask[];
}
export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  completed?: boolean;
}
