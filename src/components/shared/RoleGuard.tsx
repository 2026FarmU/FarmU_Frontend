'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import type { UserRole } from '@/types/auth';

interface RoleGuardProps {
  allow: UserRole[];
  children: React.ReactNode;
}

export function RoleGuard({ allow, children }: RoleGuardProps) {
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user || !allow.includes(user.role)) {
      router.replace(allow.length === 1 && allow[0] === 'SUPER_ADMIN' ? '/admin/login' : '/login');
    }
  }, [hasHydrated, user, allow, router]);

  if (!hasHydrated) {
    return (
      <div style={{ padding: 80, textAlign: 'center', color: '#939498', fontSize: 14 }}>
        로그인 확인 중…
      </div>
    );
  }

  if (!user || !allow.includes(user.role)) return null;
  return <>{children}</>;
}
