'use client';

import { useAuthStore } from '@/lib/store/authStore';
import { AppLayout } from '@/components/layout/AppLayout';

export default function AppRouteLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  const initial = user.name?.[0]?.toUpperCase() ?? 'U';
  const isAdmin = user.role === 'UNION_ADMIN';
  const meta =
    user.role === 'SUPER_ADMIN' ? '시스템 관리자'
    : user.role === 'UNION_ADMIN' ? '운영 책임자'
    : '조합원';

  return (
    <AppLayout
      profile={{ name: user.name, meta, initial, isAdmin }}
      headerProps={{
        showAdminPill: isAdmin,
        avatarInitial: initial,
        searchPlaceholder: '페이지·주소 검색',
      }}
    >
      {children}
    </AppLayout>
  );
}
