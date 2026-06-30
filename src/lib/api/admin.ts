import { apiClient } from './instance';

/* ─ Types ─────────────────────────────────────────── */

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalUnions: number;
  activeUnions: number;
  totalMembers: number;
  totalReports: number;
}

export interface AdminUser {
  userId: string;
  loginId: string;
  name: string;
  role: string;
  unionId: string | null;
  unionName: string | null;
  isWithdrawn: boolean;
  createdAt: string;
}

export interface AdminUnion {
  unionId: string;
  code: string;
  name: string;
  isActive: boolean;
  memberCount?: number;
  userCount?: number;
}

export interface AdminNotice {
  noticeId: string;
  title: string;
  content: string;
  targetRole: 'ALL' | 'UNION_ADMIN' | 'MEMBER';
  createdAt: string;
}

export interface AdminLog {
  logId: string;
  userId: string | null;
  loginId: string | null;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface PageResponse<T> {
  data: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

/* ─ API ────────────────────────────────────────────── */

export const adminApi = {
  getStats: () =>
    apiClient.get<{ data: AdminStats }>('/admin/stats'),

  getUnions: (params?: { page?: number; size?: number }) =>
    apiClient.get<PageResponse<AdminUnion>>('/admin/unions', { params }),

  createUnion: (body: { code: string; name: string; isActive?: boolean }) =>
    apiClient.post<{ data: AdminUnion }>('/admin/unions', body),

  updateUnion: (unionId: string, body: { isActive: boolean }) =>
    apiClient.patch(`/admin/unions/${unionId}`, body),

  getUsers: (params?: { role?: string; page?: number; size?: number }) =>
    apiClient.get<PageResponse<AdminUser>>('/admin/users', { params }),

  disableUser: (userId: string) =>
    apiClient.delete(`/admin/users/${userId}`),

  restoreUser: (userId: string) =>
    apiClient.post(`/admin/users/${userId}/restore`),

  resetPassword: (userId: string, password: string) =>
    apiClient.post(`/admin/users/${userId}/reset-password`, { password }),

  getLogs: (params?: { page?: number; size?: number }) =>
    apiClient.get<PageResponse<AdminLog>>('/admin/logs', { params }),

  getNotices: (params?: { page?: number; size?: number }) =>
    apiClient.get<PageResponse<AdminNotice>>('/admin/notices', { params }),

  createNotice: (body: { title: string; content: string; targetRole: 'ALL' | 'UNION_ADMIN' | 'MEMBER' }) =>
    apiClient.post<{ data: AdminNotice }>('/admin/notices', body),

  deleteNotice: (noticeId: string) =>
    apiClient.delete(`/admin/notices/${noticeId}`),
} as const;
