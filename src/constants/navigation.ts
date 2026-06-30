import type { UserRole } from '@/types/auth';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: UserRole[];
}

/**
 * 사이드바 메뉴 — 시안(V2_adminShell, V2_appShell)을 기준으로 역할별 노출.
 * 명세상 역할은 2개: UNION_ADMIN(컨설턴트 역할 겸임) / MEMBER.
 */
export const NAV_ITEMS: NavItem[] = [
  // 운영 책임자 전용
  { label: '대시보드', href: '/dashboard', icon: '/icons/dashboard.svg', roles: ['UNION_ADMIN'] },
  { label: '조합원 목록', href: '/members', icon: '/icons/people.svg', roles: ['UNION_ADMIN'] },

  // MEMBER 진입점
  { label: '내 분석', href: '/me/analysis', icon: '/icons/growth.svg', roles: ['MEMBER'] },

  // 공용
  { label: '출하 추천', href: '/shipping', icon: '/icons/shipment.svg', roles: ['UNION_ADMIN', 'MEMBER'] },
  { label: '필지·경축', href: '/lands', icon: '/icons/crop.svg', roles: ['UNION_ADMIN', 'MEMBER'] },
  { label: '개선 시나리오', href: '/scenarios', icon: '/icons/analyze.svg', roles: ['UNION_ADMIN', 'MEMBER'] },
  { label: '리포트', href: '/reports', icon: '/icons/report.svg', roles: ['UNION_ADMIN', 'MEMBER'] },

  // MEMBER 전용
  { label: '조합원 연결', href: '/mentoring', icon: '/icons/people.svg', roles: ['MEMBER'] },

  // 운영 책임자 전용 — 멘토링 승인 / 운영 설정(데이터 업로드 + 성과 가중치)
  { label: '멘토링 승인', href: '/mentoring/manage', icon: '/icons/people.svg', roles: ['UNION_ADMIN'] },
  { label: '운영 설정', href: '/settings/operations', icon: '/icons/report.svg', roles: ['UNION_ADMIN'] },

  // 공용
  { label: '프로필', href: '/settings/profile', icon: '/icons/profile.svg', roles: ['UNION_ADMIN', 'MEMBER'] },

  // 슈퍼 관리자 전용
  { label: '계정 관리', href: '/admin', icon: '/icons/people.svg', roles: ['SUPER_ADMIN'] },
];

export const HOME_BY_ROLE: Record<UserRole, string> = {
  UNION_ADMIN: '/dashboard',
  MEMBER: '/me/analysis',
  SUPER_ADMIN: '/admin',
};

export const ROUTE_ROLE_MAP: Array<{ pattern: RegExp; roles: UserRole[] }> = [
  { pattern: /^\/dashboard/, roles: ['UNION_ADMIN'] },
  { pattern: /^\/members/, roles: ['UNION_ADMIN'] },
  { pattern: /^\/me\//, roles: ['MEMBER'] },
  { pattern: /^\/shipping/, roles: ['UNION_ADMIN', 'MEMBER'] },
  { pattern: /^\/lands/, roles: ['UNION_ADMIN', 'MEMBER'] },
  { pattern: /^\/scenarios/, roles: ['UNION_ADMIN', 'MEMBER'] },
  { pattern: /^\/reports/, roles: ['UNION_ADMIN', 'MEMBER'] },
  { pattern: /^\/mentoring\/manage/, roles: ['UNION_ADMIN'] },
  { pattern: /^\/mentoring/, roles: ['MEMBER'] },
  { pattern: /^\/settings\/operations/, roles: ['UNION_ADMIN'] },
  { pattern: /^\/settings\/profile/, roles: ['UNION_ADMIN', 'MEMBER'] },
  { pattern: /^\/admin/, roles: ['SUPER_ADMIN'] },
];

export function getNavItemsForRole(role: UserRole | null | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
