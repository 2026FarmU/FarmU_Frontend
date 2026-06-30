// 로그인 세션을 심고 특정 화면을 띄워 스크린샷·콘솔에러를 뽑는 수동 검증 스크립트.
// 토큰을 하드코딩하지 않고 매 실행마다 데모 계정으로 새로 로그인한다.
//
// 사용법:
//   node scripts/e2e/verify.mjs <route> [admin|member]
// 예:
//   node scripts/e2e/verify.mjs /shipping
//   node scripts/e2e/verify.mjs /lands admin
//   HEADLESS=0 node scripts/e2e/verify.mjs /reports   ← 창 띄워서 보기
//
// 환경변수: API_BASE(기본 http://43.202.51.195), APP_BASE(기본 http://localhost:3000),
//           UNION_CODE(기본 DEMO), PASSWORD(기본 FarmU2026!)

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROUTE = process.argv[2] || '/dashboard';
const ROLE = (process.argv[3] || 'admin').toLowerCase();
const API_BASE = process.env.API_BASE || 'http://43.202.51.195';
const APP_BASE = process.env.APP_BASE || 'http://localhost:3000';
const UNION_CODE = process.env.UNION_CODE || 'DEMO';
const PASSWORD = process.env.PASSWORD || 'FarmU2026!';
const LOGIN_ID = ROLE === 'member' ? 'demo_member' : 'demo_admin';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HEADLESS = process.env.HEADLESS !== '0';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'out');

async function login() {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId: LOGIN_ID, password: PASSWORD, unionCode: UNION_CODE }),
  });
  if (!res.ok) throw new Error(`login ${res.status}: ${await res.text()}`);
  return (await res.json()).data; // { accessToken, refreshToken?, user }
}

const { accessToken, refreshToken = '', user } = await login();
const auth = { state: { user, accessToken, refreshToken, isAuthenticated: true }, version: 0 };

const browser = await chromium.launch({ executablePath: CHROME, headless: HEADLESS });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'accessToken', value: accessToken, domain: 'localhost', path: '/' }]);
await ctx.addInitScript(
  ([a, t, r, uid]) => {
    localStorage.setItem('farmu-auth', JSON.stringify(a));
    localStorage.setItem('accessToken', t);
    if (r) localStorage.setItem('refreshToken', r);
    localStorage.setItem('activeUnionId', uid);
    localStorage.setItem('activeUnionCode', 'DEMO');
  },
  [auth, accessToken, refreshToken, user.unionId],
);

const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(`${APP_BASE}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);

const shot = join(OUT_DIR, `${ROUTE.replace(/\W+/g, '_').replace(/^_/, '') || 'root'}.png`);
await page.screenshot({ path: shot, fullPage: true });

console.log(`route   : ${ROUTE} (${LOGIN_ID})`);
console.log(`screenshot: ${shot}`);
console.log(`console errors (${errors.length}):`, errors.slice(0, 8));

await browser.close();
