'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { CircleCheck } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import { authApi } from '@/lib/api/auth';
import { persistTokens } from '@/lib/auth/session';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import type { UserRole } from '@/types/auth';

export default function AdminLoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !password) { toast.error('아이디와 비밀번호를 입력해주세요'); return; }
    setLoading(true);
    try {
      const { data } = await authApi.login({ loginId, password, unionCode: '' });
      const { accessToken, user } = data.data;
      const refreshToken = (data.data as { refreshToken?: string }).refreshToken ?? '';
      const userRole = user.role as UserRole;
      if (userRole !== 'SUPER_ADMIN') { toast.error('관리자 계정이 아닙니다'); setLoading(false); return; }
      setAuth({ userId: user.userId, name: user.name, role: userRole, unionId: user.unionId }, accessToken, refreshToken);
      if (typeof window !== 'undefined') persistTokens(accessToken, refreshToken || undefined);
      toast.success('관리자로 로그인했습니다', { icon: <CircleCheck size={18} color="#6b6d70" /> });
      router.push('/admin');
    } catch (err) {
      const detail = isAxiosError(err) ? (err.response?.data as { detail?: string } | undefined)?.detail : undefined;
      toast.error(detail ?? '로그인에 실패했습니다');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-8 py-12 bg-white">
      <div className="w-full max-w-2xl flex flex-col items-center">

        {/* 로고 */}
        <div className="flex items-center gap-3 mb-4">
          <Image src="/images/logo.png" alt="팜유" width={72} height={72} priority className="w-18 h-18" />
          <span
            className="text-[48px] leading-none text-[#397359]"
            style={{ fontFamily: 'var(--font-kbl-court)', letterSpacing: '-0.02em' }}
          >
            팜유
          </span>
        </div>

        <p className="text-[17px] text-fg-muted mb-14 text-center">
          농업 공공데이터 + AI로 조합 운영의 매일을 가볍게 만드는 플랫폼
        </p>

        {/* 로그인 폼 */}
        <div className="w-full max-w-lg">
          <form
            onSubmit={submit}
            style={{ ['--accent' as string]: '#939498', ['--accent-soft' as string]: '#f0f4f6' }}
            className="bg-white border border-[#e5e7e0] rounded-3xl p-10 shadow-sm grid gap-5"
          >
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="관리자 아이디"
              required
              autoCapitalize="off"
              autoCorrect="off"
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
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-5 rounded-xl font-bold text-[19px] text-white disabled:opacity-60"
              style={{ backgroundColor: '#939498' }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#adb8c0'; }}
              onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#939498'; }}
            >
              {loading ? '로그인 중…' : '관리자 로그인'}
            </button>
          </form>
        </div>
      </div>

      {/* 돌아가기 */}
      <div className="flex justify-center mt-4">
        <button
          onClick={() => router.push('/login')}
          className="px-8 py-3 rounded-lg text-[15px] text-white font-semibold"
          style={{ backgroundColor: '#515151' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3a3a3a'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#515151'; }}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
