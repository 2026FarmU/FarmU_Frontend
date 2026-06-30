'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, CircleCheck } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import { authApi } from '@/lib/api/auth';
import { persistTokens } from '@/lib/auth/session';
import { HOME_BY_ROLE } from '@/constants/navigation';
import type { UserRole } from '@/types/auth';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';

type Role = 'UNION_ADMIN' | 'MEMBER' | null;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState<'role' | 'form'>('role');
  const [role, setRole] = useState<Role>(null);
  const [unionCode, setUnionCode] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // 선택한 역할의 대표색 (로그인 버튼과 동일) — input 포커스 보더/링에 사용
  const accent = role === 'UNION_ADMIN' ? '#41AA4D' : '#2563eb';
  const accentSoft = role === 'UNION_ADMIN' ? '#edf7ee' : '#eff6ff';

  const handleRoleSelect = (r: Role) => {
    setRole(r);
    setStep('form');
  };
  const handleBack = () => {
    setStep('role');
    setRole(null);
    setUnionCode('');
    setLoginId('');
    setPassword('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unionCode || !loginId || !password) {
      toast.error('조합코드, 아이디, 비밀번호를 모두 입력해주세요');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.login({ loginId, password, unionCode });
      const { accessToken, user } = data.data;
      // 백엔드 로그인 응답에는 refreshToken이 없음(쿠키 기반일 수 있음) → 있으면 저장
      const refreshToken = (data.data as { refreshToken?: string }).refreshToken ?? '';
      const userRole = user.role as UserRole;

      setAuth(
        { userId: user.userId, name: user.name, role: userRole, unionId: user.unionId },
        accessToken,
        refreshToken,
      );
      if (typeof window !== 'undefined') {
        persistTokens(accessToken, refreshToken || undefined); // flat 키 + 미들웨어용 쿠키(30일)
        localStorage.setItem('activeUnionId', user.unionId ?? ''); // 인터셉터 X-Union-Id 헤더용
        localStorage.setItem('activeUnionCode', unionCode); // 조합원 계정 발급 시 사용
      }
      toast.success(`${userRole === 'UNION_ADMIN' ? '운영 책임자' : '조합원'}로 로그인했습니다`, {
        icon: <CircleCheck size={18} color="#41AA4D" />,
      });
      router.push(HOME_BY_ROLE[userRole]);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(detail ?? '로그인에 실패했습니다. 조합코드·아이디·비밀번호를 확인해주세요');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-8 py-12 bg-white">
      <div className="w-full max-w-2xl flex flex-col items-center">
        {/* 로고 */}
        <div className="flex items-center gap-3 mb-4">
          <Image
            src="/images/logo.png"
            alt="팜유"
            width={72}
            height={72}
            priority
            className="w-18 h-18"
          />
          <span
            className="text-[48px] leading-none text-[#397359]"
            style={{ fontFamily: 'var(--font-kbl-court)', letterSpacing: '-0.02em' }}
          >
            팜유
          </span>
        </div>

        {/* 서비스 설명 */}
        <p className="text-[17px] text-fg-muted mb-14 text-center">
          농업 공공데이터 + AI로 조합 운영의 매일을 가볍게 만드는 플랫폼
        </p>

        {/* Step 1 — 역할 선택 */}
        {step === 'role' && (
          <div className="grid grid-cols-2 gap-6 w-full">
            {[
              {
                r: 'UNION_ADMIN' as Role,
                label: '운영 책임자',
                desc: '조합 관리자 · 컨설턴트',
                emoji: '👨‍💼',
                bg: '#edf7ee',
                btnBg: '#41AA4D',
              },
              {
                r: 'MEMBER' as Role,
                label: '조합원',
                desc: '일반 농가 조합원',
                emoji: '🌱',
                bg: '#eff6ff',
                btnBg: '#2563eb',
              },
            ].map(({ r, label, desc, emoji, bg, btnBg }) => (
              <button
                key={r}
                onClick={() => handleRoleSelect(r)}
                className="relative overflow-hidden rounded-3xl border-2 border-transparent text-left"
                style={{ backgroundColor: bg }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = btnBg + '66';
                  (e.currentTarget as HTMLButtonElement)
                    .querySelector('.login-btn')!
                    .setAttribute('style', `background-color: ${btnBg}dd`);
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                  (e.currentTarget as HTMLButtonElement)
                    .querySelector('.login-btn')!
                    .setAttribute('style', `background-color: ${btnBg}`);
                }}
              >
                <div className="px-12 py-14 flex flex-col items-center gap-5">
                  <span className="text-[72px] leading-none">{emoji}</span>
                  <div className="text-[22px] font-extrabold text-fg">{label}</div>
                  <div className="text-[15px] text-fg-muted">{desc}</div>
                </div>
                <div
                  className="login-btn py-5 text-white text-[18px] font-bold text-center"
                  style={{ backgroundColor: btnBg }}
                >
                  로그인
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — 로그인 폼 */}
        {step === 'form' && (
          <div className="w-full max-w-lg">
            <div className="mb-8 text-center">
              <div
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-[15px] font-bold"
                style={{
                  background: role === 'UNION_ADMIN' ? '#edf7ee' : '#eff6ff',
                  color: role === 'UNION_ADMIN' ? '#2a8035' : '#1d4ed8',
                }}
              >
                {role === 'UNION_ADMIN' ? '운영 책임자' : '조합원'} 로그인
              </div>
            </div>

            <form
              onSubmit={submit}
              style={{ ['--accent' as string]: accent, ['--accent-soft' as string]: accentSoft }}
              className="bg-white border border-[#e5e7e0] rounded-3xl p-10 shadow-sm grid gap-5"
            >
              <input
                type="text"
                value={unionCode}
                onChange={(e) => setUnionCode(e.target.value)}
                placeholder="조합코드"
                required
                autoCapitalize="off"
                autoCorrect="off"
                className="w-full px-5 py-4.5 rounded-xl border border-[#e5e7e0] bg-white text-[17px] placeholder:text-[#b0b7b0] focus:outline-none focus:ring-3 focus:border-(--accent) focus:ring-(--accent-soft)"
              />
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="아이디"
                required
                className="w-full px-5 py-4.5 rounded-xl border border-[#e5e7e0] bg-white text-[17px] placeholder:text-[#b0b7b0] focus:outline-none focus:ring-3 focus:border-(--accent) focus:ring-(--accent-soft)"
              />
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  required
                  className="w-full px-5 py-4.5 pr-14 rounded-xl border border-[#e5e7e0] bg-white text-[17px] placeholder:text-[#b0b7b0] focus:outline-none focus:ring-3 focus:border-(--accent) focus:ring-(--accent-soft)"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
                >
                  {showPw ? (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full py-5 rounded-xl font-bold text-[19px] text-white disabled:opacity-60"
                style={{ backgroundColor: role === 'UNION_ADMIN' ? '#41AA4D' : '#2563eb' }}
                onMouseEnter={(e) => {
                  if (!loading)
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      role === 'UNION_ADMIN' ? '#339940' : '#1d4ed8';
                }}
                onMouseLeave={(e) => {
                  if (!loading)
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      role === 'UNION_ADMIN' ? '#41AA4D' : '#2563eb';
                }}
              >
                {`${role === 'UNION_ADMIN' ? '운영 책임자' : '조합원'} 로그인`}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 돌아가기 — 폼 아래 정상 흐름 배치 */}
      <div className={`flex justify-center ${step === 'role' ? 'mt-4' : 'mt-0'}`}>
        <button
          onClick={step === 'form' ? handleBack : () => router.back()}
          className="px-8 py-3 rounded-lg text-[15px] text-white font-semibold"
          style={{ backgroundColor: '#515151' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3a3a3a';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#515151';
          }}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
