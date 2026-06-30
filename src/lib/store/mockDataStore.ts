import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ── 출하 추천 ──────────────────────────────────────────────── */
export interface ShippingDecision {
  id: string;
  status: 'accepted' | 'rejected';
  actualDate?: string;
  reason?: string;
  decidedAt: string;
}

/* ── 시나리오 ─────────────────────────────────────────────────── */
export interface SavedScenario {
  id: string;
  name: string;
  memberId: string;
  land: string;
  crop: string;
  areaRatio: number;
  startDate: string;
  scoreDelta: string;
  revDelta: string;
  confidence: number;
  createdAt: string;
}

/* ── 리포트 ──────────────────────────────────────────────────── */
export type ReportStatus = 'processing' | 'done' | 'fail';
export interface ReportItem {
  id: string;
  name: string;
  type: string;
  target: string;
  status: ReportStatus;
  createdAt: string;
  size?: string;
  errorMsg?: string;
  format: 'PDF' | 'XLSX';
}

/* ── 멘토링 칸반 ──────────────────────────────────────────────── */
export interface KanbanCard {
  id: string;
  title: string;
  assignee: string;
  assigneeInit: string;
  dday: string;
  urgent?: boolean;
}
export interface KanbanState {
  todo: KanbanCard[];
  doing: KanbanCard[];
  done: KanbanCard[];
}

export interface MatchRequest {
  id: string;
  mentorName: string;
  menteeId: string;
  goal: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

/* ── 알림 ────────────────────────────────────────────────────── */
export interface NotifItem {
  id: string;
  level: 'high' | 'medium' | 'low';
  title: string;
  desc: string;
  time: string;
  read: boolean;
}

/* ── 프로필 ──────────────────────────────────────────────────── */
export interface ProfileData {
  name: string;
  email: string;
  phone: string;
  mainCrop?: string;
  bio: string;
  notif: {
    danger_push: boolean; danger_email: boolean; danger_sms: boolean;
    ship_push: boolean; ship_email: boolean;
    report_email: boolean;
    mentoring_push: boolean; mentoring_email: boolean;
  };
}

/* ── 스토어 타입 ─────────────────────────────────────────────── */
interface MockState {
  /* 출하 */
  shippingDecisions: Record<string, ShippingDecision>;
  decide: (id: string, d: Omit<ShippingDecision, 'id' | 'decidedAt'>) => void;

  /* 시나리오 */
  savedScenarios: SavedScenario[];
  saveScenario: (s: Omit<SavedScenario, 'id' | 'createdAt'>) => void;
  deleteScenario: (id: string) => void;

  /* 리포트 */
  reports: ReportItem[];
  addReport: (r: Omit<ReportItem, 'id' | 'createdAt' | 'status'>) => string;
  updateReportStatus: (id: string, status: ReportStatus, size?: string, errorMsg?: string) => void;

  /* 멘토링 */
  kanban: KanbanState;
  moveCard: (cardId: string, from: keyof KanbanState, to: keyof KanbanState) => void;
  addKanbanCard: (col: keyof KanbanState, card: Omit<KanbanCard, 'id'>) => void;
  matchRequests: MatchRequest[];
  requestMatch: (mentorName: string, goal: string) => void;

  /* 알림 */
  notifications: NotifItem[];
  markRead: (id: string) => void;
  markAllRead: () => void;

  /* 프로필 */
  profile: ProfileData;
  saveProfile: (p: Partial<ProfileData>) => void;
  updateNotifPref: (key: keyof ProfileData['notif'], val: boolean) => void;
}

const INITIAL_REPORTS: ReportItem[] = [
  { id: 'r-001', name: '2026-04 조합 월간 리포트', type: '조합 월간', target: '조합 전체', status: 'done', createdAt: '2026-05-02', size: '4.2MB', format: 'PDF' },
  { id: 'r-002', name: '2026-04 조합원1 액션플랜', type: '액션플랜', target: '조합원1', status: 'done', createdAt: '2026-05-02', size: '1.1MB', format: 'PDF' },
  { id: 'r-003', name: '2026-04 출하 실적 리포트', type: '출하 실적', target: '조합 전체', status: 'done', createdAt: '2026-05-01', size: '2.8MB', format: 'PDF' },
  { id: 'r-004', name: '2026-03 조합 월간 리포트', type: '조합 월간', target: '조합 전체', status: 'fail', createdAt: '2026-04-02', errorMsg: '데이터 부족', format: 'PDF' },
];

const INITIAL_KANBAN: KanbanState = {
  todo: [
    { id: 'k-1', title: '출하일 점검 회의', assignee: '박○○ 멘토', assigneeInit: '박', dday: 'D-3', urgent: true },
    { id: 'k-2', title: '자재비 청구 비교 자료 공유', assignee: '조합원3', assigneeInit: '조', dday: '기한 미정' },
  ],
  doing: [
    { id: 'k-3', title: '사과 적기 출하 가이드 작성', assignee: '박○○ 멘토', assigneeInit: '박', dday: 'D-10', urgent: true },
  ],
  done: [
    { id: 'k-4', title: '상견례·목표 정렬', assignee: '박○○ 멘토', assigneeInit: '박', dday: '2026-05-15' },
    { id: 'k-5', title: '필지 진단 동행', assignee: '박○○ 멘토', assigneeInit: '박', dday: '2026-05-22' },
  ],
};

const INITIAL_NOTIFICATIONS: NotifItem[] = [
  { id: 'n-1', level: 'high', title: '사과 가격 하락 위험', desc: '최근 5일 동안 평균 가격 −12.4%. 사과 보유 조합원 8명 영향.', time: '5분 전', read: false },
  { id: 'n-2', level: 'high', title: '한우 #B-1187 출하 적기 도래', desc: '2026-06-08 권고일 D-3. 예상 수익 ₩ 7.8M.', time: '12분 전', read: false },
  { id: 'n-3', level: 'medium', title: '기상 알림 — 주말 강수 예보', desc: '토–일 누적 강수량 35mm 이상. 노지 작업 일정 조정 권장.', time: '1시간 전', read: false },
  { id: 'n-4', level: 'low', title: '2026-04 조합 월간 리포트 다운로드 준비됨', desc: 'PDF · 4.2MB. 만료 23시간 후.', time: '3시간 전', read: false },
  { id: 'n-5', level: 'low', title: '멘토 박○○ 매칭 요청 수락', desc: '상견례 일정을 정해 주세요.', time: '어제', read: true },
];

const INITIAL_PROFILE: ProfileData = {
  name: '조합원1',
  email: 'member1@farmu.kr',
  phone: '010-0000-0000',
  mainCrop: '사과',
  bio: '',
  notif: {
    danger_push: true, danger_email: true, danger_sms: false,
    ship_push: true, ship_email: false,
    report_email: true,
    mentoring_push: true, mentoring_email: true,
  },
};

export const useMockStore = create<MockState>()(
  persist(
    (set) => ({
      /* 출하 */
      shippingDecisions: {},
      decide: (id, d) =>
        set((s) => ({
          shippingDecisions: {
            ...s.shippingDecisions,
            [id]: { ...d, id, decidedAt: new Date().toISOString() },
          },
        })),

      /* 시나리오 */
      savedScenarios: [],
      saveScenario: (s) =>
        set((st) => ({
          savedScenarios: [
            {
              ...s,
              id: `scen-${Date.now()}`,
              createdAt: new Date().toLocaleDateString('ko-KR'),
            },
            ...st.savedScenarios,
          ],
        })),
      deleteScenario: (id) =>
        set((s) => ({ savedScenarios: s.savedScenarios.filter((x) => x.id !== id) })),

      /* 리포트 */
      reports: INITIAL_REPORTS,
      addReport: (r) => {
        const id = `rep-${Date.now()}`;
        set((s) => ({
          reports: [
            { ...r, id, status: 'processing', createdAt: '방금 전' },
            ...s.reports,
          ],
        }));
        return id;
      },
      updateReportStatus: (id, status, size, errorMsg) =>
        set((s) => ({
          reports: s.reports.map((r) =>
            r.id === id ? { ...r, status, ...(size ? { size } : {}), ...(errorMsg ? { errorMsg } : {}) } : r
          ),
        })),

      /* 멘토링 */
      kanban: INITIAL_KANBAN,
      moveCard: (cardId, from, to) =>
        set((s) => {
          const card = s.kanban[from].find((c) => c.id === cardId);
          if (!card) return s;
          return {
            kanban: {
              ...s.kanban,
              [from]: s.kanban[from].filter((c) => c.id !== cardId),
              [to]: [...s.kanban[to], card],
            },
          };
        }),
      addKanbanCard: (col, card) =>
        set((s) => ({
          kanban: {
            ...s.kanban,
            [col]: [...s.kanban[col], { ...card, id: `k-${Date.now()}` }],
          },
        })),
      matchRequests: [],
      requestMatch: (mentorName, goal) =>
        set((s) => ({
          matchRequests: [
            ...s.matchRequests,
            {
              id: `mr-${Date.now()}`,
              mentorName,
              menteeId: 'me',
              goal,
              status: 'pending',
              createdAt: new Date().toLocaleDateString('ko-KR'),
            },
          ],
        })),

      /* 알림 */
      notifications: INITIAL_NOTIFICATIONS,
      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      markAllRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      /* 프로필 */
      profile: INITIAL_PROFILE,
      saveProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      updateNotifPref: (key, val) =>
        set((s) => ({ profile: { ...s.profile, notif: { ...s.profile.notif, [key]: val } } })),
    }),
    { name: 'farmu-mock' }
  )
);
