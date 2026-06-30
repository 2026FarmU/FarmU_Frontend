import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 비로그인 방문자도 접근하는 공개 경로 (랜딩 + 도입 문의 API)
const PUBLIC_PATHS = ['/login', '/admin/login', '/', '/api/contact'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 경로 또는 정적 파일은 통과
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  // 쿠키 기반 토큰 확인 (역할별 가드는 (app)/layout.tsx + RoleGuard 가 담당)
  const token = request.cookies.get('accessToken')?.value;
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|videos|video|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|mov)$).*)',
  ],
};
