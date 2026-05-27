export type UserRole = 'UNION_ADMIN' | 'MEMBER' | 'CONSULTANT';

export interface LoginRequest {
  loginId: string;
  password: string;
  unionCode: string;
}

export interface AuthUser {
  userId: string;
  name: string;
  role: UserRole;
  unionId: string;
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
}
