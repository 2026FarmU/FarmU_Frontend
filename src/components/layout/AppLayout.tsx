'use client';
import { useAuthStore } from '@/lib/store/authStore';

import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NotificationModal } from './NotificationModal';

interface AppLayoutProps {
  children: React.ReactNode;
  profile: { name: string; meta: string; initial: string; isAdmin?: boolean };
  headerProps?: { showAdminPill?: boolean; avatarInitial?: string; searchPlaceholder?: string };
}

export function AppLayout({ children, profile, headerProps }: AppLayoutProps) {
  const role = useAuthStore((s) => s.user?.role);
  const isMember = role === 'MEMBER';

  return (
    <div
      className={[
        "min-h-screen grid",
        "grid-cols-[260px_1fr] grid-rows-[72px_1fr]",
        "[grid-template-areas:'header_header'_'sidebar_main']",
        "max-[900px]:grid-cols-[220px_1fr]",
        "max-[720px]:grid-cols-[1fr]",
        "max-[720px]:[grid-template-areas:'header'_'main']",
        isMember ? "member-theme" : "",
      ].join(" ")}
    >
      <Header {...headerProps} />
      <Sidebar profile={profile} />
      <main className="overflow-y-auto px-7 pt-6 pb-14 [grid-area:main]">{children}</main>
      <NotificationModal />
    </div>
  );
}
