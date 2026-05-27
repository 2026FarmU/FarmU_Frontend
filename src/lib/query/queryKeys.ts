// TanStack Query 키 팩토리 — 캐시 무효화를 위해 중앙 관리

export const queryKeys = {
  // Auth
  me: () => ['auth', 'me'] as const,

  // Dashboard
  dashboard: {
    summary: (unionId: string, period: string) =>
      ['dashboard', 'summary', unionId, period] as const,
    trends: (unionId: string, from: string, to: string, metric: string) =>
      ['dashboard', 'trends', unionId, from, to, metric] as const,
    alerts: (unionId: string, params?: object) => ['dashboard', 'alerts', unionId, params] as const,
  },

  // Members
  members: {
    ranking: (unionId: string, period: string, params?: object) =>
      ['members', 'ranking', unionId, period, params] as const,
    analysis: (memberId: string, period: string) =>
      ['members', 'analysis', memberId, period] as const,
  },

  // Shipping
  shipping: {
    recommendations: (params: object) => ['shipping', 'recommendations', params] as const,
    accuracy: (unionId: string, from: string, to: string) =>
      ['shipping', 'accuracy', unionId, from, to] as const,
  },

  // Lands
  lands: {
    byMember: (memberId: string) => ['lands', memberId] as const,
    suitability: (landId: string) => ['lands', 'suitability', landId] as const,
  },

  // Scenarios
  scenarios: {
    list: (memberId: string) => ['scenarios', memberId] as const,
  },

  // Mentoring
  mentoring: {
    suggestions: (menteeId: string) => ['mentoring', 'suggestions', menteeId] as const,
    tasks: (matchId: string) => ['mentoring', 'tasks', matchId] as const,
  },

  // Reports
  reports: {
    detail: (reportId: string) => ['reports', reportId] as const,
    list: (params?: object) => ['reports', 'list', params] as const,
  },

  // Uploads
  uploads: {
    validation: (uploadId: string) => ['uploads', 'validation', uploadId] as const,
    list: (params?: object) => ['uploads', 'list', params] as const,
  },
} as const;
