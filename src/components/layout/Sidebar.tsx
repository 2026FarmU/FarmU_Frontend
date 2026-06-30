'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, X, Mail } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { getNavItemsForRole } from '@/constants/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { authApi } from '@/lib/api/auth';
import { clearTokens } from '@/lib/auth/session';

interface SidebarProps {
  profile: { name: string; meta: string; initial: string; isAdmin?: boolean };
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const accentColor = role === 'UNION_ADMIN' ? '#41AA4D' : '#2563eb';
  const accentSoft = role === 'UNION_ADMIN' ? '#e8f5e9' : '#eff6ff';
  const accentDeep = role === 'UNION_ADMIN' ? '#2e7d32' : '#1d4ed8';
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const items = getNavItemsForRole(user?.role);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 하단 텍스트 — 개인정보처리방침 / 문의하기 모달
  const [infoModal, setInfoModal] = useState<'contact' | 'privacy' | null>(null);
  const [cf, setCf] = useState({ name: '', email: '', content: '' });
  const [sending, setSending] = useState(false);
  // 프로필 이름 1회 프리필
  const [cfSynced, setCfSynced] = useState(false);
  if (user?.name && !cfSynced) {
    setCfSynced(true);
    setCf((f) => ({ ...f, name: user.name }));
  }

  const submitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cf.name.trim() || !cf.email.trim()) { toast.error('이름과 이메일은 필수입니다'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ union: user?.unionId ?? '', name: cf.name.trim(), email: cf.email.trim(), message: cf.content.trim() || '(내용 없음)' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? '전송 실패');
      }
      toast.success('문의가 접수되었습니다. 확인 후 회신드리겠습니다.');
      setInfoModal(null);
      setCf((f) => ({ ...f, content: '' }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '문의 전송에 실패했습니다');
    } finally {
      setSending(false);
    }
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    clearTokens();
    clearAuth();
    router.push('/login');
  };

  return (
    <aside
      className="
        sticky top-[72px] h-[calc(100vh-72px)]
        bg-white border-r border-border-soft
        p-4 flex flex-col gap-2 overflow-y-auto
        [grid-area:sidebar]
        max-[720px]:hidden
      "
    >
      <div className="flex items-center gap-3 px-2 pb-5 pt-2">
        <div
          className="w-11 h-11 rounded-full grid place-items-center font-bold text-[15px] flex-none"
          style={isSuperAdmin
            ? { backgroundColor: '#f0f0f1', color: '#6b6d70' }
            : profile.isAdmin
              ? { backgroundColor: '#edf8ee', color: '#41AA4D' }
              : { backgroundColor: '#eff6ff', color: '#1d4ed8' }
          }
        >
          {profile.initial}
        </div>
        <div>
          <div className="font-bold text-[15px]">{profile.name}</div>
          <div className="text-xs text-fg-muted mt-0.5">{profile.meta}</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 mt-1">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + '/');
          return (
            <Link
              key={it.href}
              href={it.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[14.5px]',
                active
                  ? isSuperAdmin
                    ? 'font-bold'
                    : profile.isAdmin
                      ? 'bg-admin-soft text-admin font-bold'
                      : 'bg-brand-soft text-brand-deep font-bold'
                  : 'text-fg font-medium hover:bg-bg-soft'
              )}
              style={active && isSuperAdmin ? { backgroundColor: '#f0f0f1', color: '#6b6d70' } : undefined}
            >
              <Image src={it.icon} alt="" width={22} height={22} className={active ? 'opacity-100' : 'opacity-85'} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 개인정보처리방침 · 문의하기 — 구분선 위, 로그아웃 위 */}
      <div className="mt-auto flex items-center gap-1.5 px-2 pb-2 text-[13px] text-fg-muted">
        <button type="button" onClick={() => setInfoModal('privacy')} className="hover:text-brand-deep hover:underline">개인정보처리방침</button>
        {!profile.isAdmin && (
          <>
            <span className="text-border-strong">·</span>
            <button type="button" onClick={() => setInfoModal('contact')} className="hover:text-brand-deep hover:underline font-semibold">문의하기</button>
          </>
        )}
      </div>

      <div className="pt-4 border-t border-border-soft">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="
            w-full flex items-center gap-2
            px-3 py-3 rounded-[10px]
            text-danger font-bold text-[14.5px] text-left
            hover:bg-danger-bg
          "
        >
          <LogOut size={18} />
          <span>로그아웃</span>
        </button>
      </div>

      {/* 로그아웃 확인 모달 — aside의 stacking context를 벗어나도록 body로 portal */}
      {confirmOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-border-soft w-[340px] max-w-[calc(100vw-2rem)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-full bg-danger-bg text-danger grid place-items-center mb-4">
              <LogOut size={20} />
            </div>
            <div className="text-[16px] font-extrabold mb-1.5">로그아웃 하시겠어요?</div>
            <div className="text-[13px] text-fg-muted leading-relaxed mb-5">
              로그아웃하면 다시 로그인해야 합니다.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-[10px] border border-border-soft bg-white text-fg font-bold text-[14px] hover:bg-bg-soft"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => { setConfirmOpen(false); handleLogout(); }}
                className="flex-1 py-2.5 rounded-[10px] bg-danger text-white font-bold text-[14px] hover:opacity-90"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 문의하기 모달 */}
      {infoModal === 'contact' && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" onClick={() => setInfoModal(null)}>
          <form onSubmit={submitInquiry} className="bg-white rounded-2xl border border-border-soft w-[440px] max-w-full max-h-[88vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-full grid place-items-center" style={{ background: accentSoft, color: accentColor }}><Mail size={16} /></span>
                <div className="text-[16px] font-extrabold">문의하기</div>
              </div>
              <button type="button" onClick={() => setInfoModal(null)} className="p-1 text-fg-muted hover:text-fg"><X size={18} /></button>
            </div>
            <div className="text-[12.5px] text-fg-muted mb-4">문의 내용을 남겨주시면 운영자가 확인 후 입력하신 이메일로 회신드립니다.</div>

            <div className="grid grid-cols-2 max-[480px]:grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-bold text-fg-soft mb-1.5">이름</label>
                <input value={cf.name} onChange={(e) => setCf((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft" />
              </div>
              <div>
                <label className="block text-xs font-bold text-fg-soft mb-1.5">이메일 (회신용)</label>
                <input type="email" value={cf.email} onChange={(e) => setCf((f) => ({ ...f, email: e.target.value }))} placeholder="example@email.com" className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft" />
              </div>
              <div className="col-span-2 max-[480px]:col-span-1">
                <label className="block text-xs font-bold text-fg-soft mb-1.5">문의 내용</label>
                <textarea value={cf.content} onChange={(e) => setCf((f) => ({ ...f, content: e.target.value }))} rows={5} placeholder="문의하실 내용을 자유롭게 작성해 주세요. (예: 필지/목장 등록 요청 시 상세주소를 함께 적어주세요)" className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] resize-none focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft" />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="px-4 py-2.5 rounded-[10px] border border-border-soft bg-white text-fg font-bold text-[14px] hover:bg-bg-soft" onClick={() => setInfoModal(null)}>취소</button>
              <button type="submit" disabled={sending} className="px-4 py-2.5 rounded-[10px] text-white font-bold text-[14px] disabled:opacity-50" style={{ background: accentColor }}>{sending ? '전송 중…' : '문의 보내기'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* 개인정보처리방침 모달 */}
      {infoModal === 'privacy' && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" onClick={() => setInfoModal(null)}>
          <div className="bg-white rounded-2xl border border-border-soft w-[480px] max-w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="text-[16px] font-extrabold">개인정보처리방침</div>
              <button type="button" onClick={() => setInfoModal(null)} className="p-1 text-fg-muted hover:text-fg"><X size={18} /></button>
            </div>
            <div className="text-[12.5px] text-fg-soft leading-relaxed space-y-3">
              <p><b>1. 수집 항목</b><br />서비스 이용 시 이름·이메일·연락처, 문의 시 입력한 상세주소·문의 내용을 수집합니다.</p>
              <p><b>2. 이용 목적</b><br />조합원 운영성과 분석, 출하·경축 의사결정 지원, 문의 응대 및 회신 목적으로만 이용합니다.</p>
              <p><b>3. 보유 기간</b><br />목적 달성 후 지체 없이 파기하며, 관계 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관합니다.</p>
              <p><b>4. 제3자 제공</b><br />법령에 근거하거나 이용자 동의가 있는 경우를 제외하고 외부에 제공하지 않습니다.</p>
              <p><b>5. 문의</b><br />개인정보 관련 문의는 좌측 ‘문의하기’를 통해 접수해 주세요.</p>
              <p className="text-fg-muted">※ 본 방침은 경진대회 시연용 초안이며, 실제 서비스 적용 시 법무 검토 후 확정됩니다.</p>
            </div>
            <div className="flex justify-end mt-5">
              <button type="button" className="px-4 py-2.5 rounded-[10px] text-white font-bold text-[14px]" style={{ background: accentColor }} onClick={() => setInfoModal(null)}>확인</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
}
