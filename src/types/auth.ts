// 역할 2개 — 운영 책임자(UNION_ADMIN)가 관리자+컨설턴트 겸임
export type UserRole = 'UNION_ADMIN' | 'MEMBER' | 'SUPER_ADMIN';

export interface LoginRequest {
  loginId: string;
  password: string;
  unionCode: string;
}

export interface AuthUser {
  userId: string;
  name: string;
  role: UserRole;
  unionId: string | null;
  unionName?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface MeResponse extends AuthUser {
  permissions: string[];
  memberId?: string; // MEMBER인 경우 본인 조합원 ID (시나리오·필지·멘토링 menteeId용)
}
