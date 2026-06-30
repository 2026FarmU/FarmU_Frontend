// 세션 토큰 영속화 단일 출처.
// 미들웨어(src/middleware.ts)는 'accessToken' 쿠키의 "존재"만 검사하므로,
// 쿠키 수명을 refresh 토큰 수명(30일)에 맞추고 토큰을 갱신할 때마다 쿠키도 함께
// 갱신한다. 이렇게 해야 액세스 토큰(60분)이 만료돼도 로그인이 끊기지 않는다.

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일 — refresh 토큰 수명과 동일

/** 로그인·토큰 갱신 시: flat 키 + 미들웨어용 쿠키를 함께 기록(갱신) */
export function persistTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  document.cookie = `accessToken=${accessToken}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/** 로그아웃·세션 만료 시: 모든 세션 흔적 제거 */
export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('activeUnionId');
  document.cookie = 'accessToken=; path=/; max-age=0';
}
