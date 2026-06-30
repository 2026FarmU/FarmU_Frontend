import { apiClient } from './instance';

export interface Profile {
  userId: string;
  name: string;
  role: string;
  unionId: string;
  permissions: string[];
  memberId?: string | null;
  phone?: string | null;
  email?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  unionName?: string | null;
  joinedAt?: string | null;
  landCount?: number | null;
  region?: string | null;
  mainCrop?: string | null;
  livestock?: string | null;
}

export interface NotificationSettingItem {
  key: string;
  title: string;
  description: string;
  channels: string[];
  enabled: boolean;
}

export interface NotificationSettingGroup {
  group: string;
  items: NotificationSettingItem[];
}

// Flat view used internally after parsing grouped response
export interface NotificationSetting {
  key: string;
  channels: string[];
  enabled: boolean;
}

export const usersApi = {
  me: () => apiClient.get<{ data: Profile }>('/users/me'),

  updateProfile: (body: {
    name?: string; phone?: string; email?: string; bio?: string;
    region?: string; mainCrop?: string; livestock?: string; unionName?: string;
  }) => apiClient.patch('/users/me', body),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    apiClient.patch('/users/me/password', body),

  getNotificationSettings: () =>
    apiClient.get<{ data: NotificationSettingGroup[] }>('/users/me/notifications'),

  updateNotificationSettings: (settings: NotificationSetting[]) =>
    apiClient.put('/users/me/notifications', { settings }),

  uploadProfileImage: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return apiClient.patch<{ data: { avatarUrl: string | null; bannerUrl: string | null } }>('/users/me/images', form, {
      headers: { 'Content-Type': null as any },
    });
  },

  uploadBannerImage: (file: File) => {
    const form = new FormData();
    form.append('banner', file);
    return apiClient.patch<{ data: { avatarUrl: string | null; bannerUrl: string | null } }>('/users/me/images', form, {
      headers: { 'Content-Type': null as any },
    });
  },
} as const;
