import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  // 클라이언트 사이드 인증은 Zustand(localStorage) 기반이므로
  // 미들웨어에서는 쿠키 기반 토큰이 있을 때만 체크
  const token = request.cookies.get('accessToken')?.value;

  if (!isPublic && !token) {
    // 쿠키 토큰이 없으면 로그인 페이지로 리다이렉트
    // (localStorage 토큰은 클라이언트에서 별도 처리)
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 아래 경로는 미들웨어 제외:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico
     * - public 파일
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
