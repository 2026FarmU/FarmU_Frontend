'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { isAxiosError } from 'axios';
import {
  Plus, Trash2, Shield, Users, Building2, ChevronDown, ChevronRight,
  Eye, EyeOff, RefreshCw, Bell, ClipboardList, Activity, KeyRound,
} from 'lucide-react';
import { PageHead, cardCls } from '@/components/shared/PageHead';
import { RoleGuard } from '@/components/shared/RoleGuard';
import { authApi } from '@/lib/api/auth';
import { adminApi } from '@/lib/api/admin';
import type { AdminUser, AdminUnion, AdminNotice, AdminLog } from '@/lib/api/admin';

const ADMIN_COLOR = '#939498';
const ADMIN_DEEP = '#6b6d70';
const ADMIN_BTN = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-60';
const INPUT_CLS = 'px-4 py-2.5 rounded-lg border border-border-soft bg-white text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#939498]';

export default function AdminPage() {
  return (
    <RoleGuard allow={['SUPER_ADMIN']}>
      <AdminBody />
    </RoleGuard>
  );
}

type Tab = 'accounts' | 'unions' | 'notices' | 'logs';

function AdminBody() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('accounts');

  const statsQ = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats().then((r) => r.data.data),
  });
  const s = statsQ.data;

  const STAT_CARDS = [
    { icon: Building2, label: '전체 조합', value: s ? String(s.totalUnions) : '—', sub: `활성 ${s?.activeUnions ?? '—'}개`, color: ADMIN_COLOR },
    { icon: Users, label: '전체 사용자', value: s ? String(s.totalUsers) : '—', sub: `활성 ${s?.activeUsers ?? '—'}명`, color: '#6B9E8C' },
    { icon: Shield, label: '전체 조합원', value: s ? String(s.totalMembers) : '—', sub: '명', color: ADMIN_DEEP },
    { icon: Activity, label: '리포트', value: s ? String(s.totalReports) : '—', sub: '건', color: '#8D7BAB' },
  ];

  const TABS: { key: Tab; label: string; icon: React.FC<{ size: number }> }[] = [
    { key: 'accounts', label: '계정 관리', icon: Users },
    { key: 'unions', label: '조합 관리', icon: Building2 },
    { key: 'notices', label: '공지사항', icon: Bell },
    { key: 'logs', label: '접속 로그', icon: ClipboardList },
  ];

  return (
    <>
      <PageHead title="시스템 관리" description="조합·계정·공지·접속 로그를 통합 관리합니다." />

      {/* KPI */}
      <div className="grid grid-cols-4 max-[1100px]:grid-cols-2 max-[600px]:grid-cols-1 gap-3 mb-4">
        {STAT_CARDS.map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className={`${cardCls} flex items-center gap-3`}>
            <div className="w-10 h-10 rounded-xl grid place-items-center flex-none" style={{ background: color + '22' }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <div className="text-[11px] text-fg-muted font-bold tracking-wider uppercase">{label}</div>
              <div className="text-xl font-extrabold">{value}<small className="text-xs text-fg-muted font-semibold ml-1">{sub}</small></div>
            </div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 border-b border-border-soft">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-[13.5px] font-bold border-b-2 -mb-px transition-colors',
              tab === key ? 'border-[#6b6d70] text-[#3a3b3d]' : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tab === 'accounts' && <AccountsTab qc={qc} />}
      {tab === 'unions' && <UnionsTab qc={qc} />}
      {tab === 'notices' && <NoticesTab qc={qc} />}
      {tab === 'logs' && <LogsTab />}
    </>
  );
}

/* ── 계정 관리 ─────────────────────────────────────── */
function AccountsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'UNION_ADMIN' | 'MEMBER'>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ unionCode: '', name: '', loginId: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [disableTarget, setDisableTarget] = useState<AdminUser | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [newPw, setNewPw] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const usersQ = useQuery({
    queryKey: ['admin', 'users', roleFilter],
    queryFn: () =>
      adminApi.getUsers(roleFilter !== 'ALL' ? { role: roleFilter } : undefined)
        .then((r) => r.data.data ?? []),
  });
  const users = (usersQ.data ?? []).filter((u) => u.role !== 'SUPER_ADMIN');

  const createAccount = useMutation({
    mutationFn: () => authApi.register({ ...form }),
    onSuccess: () => {
      toast.success('계정을 발급했습니다');
      setForm({ unionCode: '', name: '', loginId: '', password: '' });
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: (e) => toast.error(isAxiosError(e) ? ((e.response?.data as { detail?: string } | undefined)?.detail ?? '발급 실패') : '발급 실패'),
  });

  const disableUser = useMutation({
    mutationFn: (userId: string) => adminApi.disableUser(userId),
    onSuccess: () => {
      toast.success('계정을 비활성화했습니다');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: () => toast.error('비활성화에 실패했습니다'),
  });

  const restoreUser = useMutation({
    mutationFn: (userId: string) => adminApi.restoreUser(userId),
    onSuccess: () => {
      toast.success('계정을 복구했습니다');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: () => toast.error('복구에 실패했습니다'),
  });

  const resetPw = useMutation({
    mutationFn: () => adminApi.resetPassword(resetTarget!.userId, newPw),
    onSuccess: () => {
      toast.success('비밀번호를 초기화했습니다');
      setResetTarget(null);
      setNewPw('');
    },
    onError: () => toast.error('초기화 실패'),
  });

  return (
    <div className="grid gap-4">
      <section className={cardCls}>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setShowCreate((v) => !v)} className={ADMIN_BTN} style={{ backgroundColor: ADMIN_DEEP }}>
            <Plus size={14} /> 계정 발급
          </button>
        </div>

        {showCreate && (
          <form
            onSubmit={(e) => { e.preventDefault(); createAccount.mutate(); }}
            className="border border-border-soft rounded-xl p-4 grid gap-3 bg-bg-soft mt-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="조합코드 (예: DEMO)" value={form.unionCode}
                onChange={(e) => setForm((f) => ({ ...f, unionCode: e.target.value }))} required className={INPUT_CLS} />
              <input type="text" placeholder="이름" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className={INPUT_CLS} />
              <input type="text" placeholder="아이디" value={form.loginId}
                onChange={(e) => setForm((f) => ({ ...f, loginId: e.target.value }))} required className={INPUT_CLS} />
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} placeholder="초기 비밀번호" value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required
                  className={INPUT_CLS + ' w-full pr-10'} />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-[13px] text-fg-muted hover:bg-white">취소</button>
              <button type="submit" disabled={createAccount.isPending} className={ADMIN_BTN} style={{ backgroundColor: ADMIN_DEEP }}>
                {createAccount.isPending ? '발급 중…' : '발급'}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className={cardCls}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[14.5px] font-bold">전체 계정 목록</div>
          <div className="flex gap-1">
            {(['ALL', 'UNION_ADMIN', 'MEMBER'] as const).map((r) => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={clsx('px-3 py-1.5 rounded-lg text-[12px] font-bold', roleFilter === r ? 'text-white' : 'text-fg-muted hover:bg-bg-soft')}
                style={roleFilter === r ? { backgroundColor: ADMIN_DEEP } : {}}>
                {r === 'ALL' ? '전체' : r === 'UNION_ADMIN' ? '운영책임자' : '조합원'}
              </button>
            ))}
          </div>
        </div>

        {usersQ.isLoading && <div className="text-center py-8 text-fg-muted text-sm">불러오는 중…</div>}
        {usersQ.isError && <div className="text-center py-8 text-fg-muted text-sm">계정 목록을 불러오지 못했습니다.</div>}

        <div className="grid gap-px">
          {users.map((u: AdminUser) => {
            const isOpen = expandedUser === u.userId;
            return (
              <div key={u.userId} className="rounded-lg overflow-hidden">
                {/* 행 */}
                <div
                  onClick={() => setExpandedUser(isOpen ? null : u.userId)}
                  className="flex items-center justify-between px-3 py-2.5 hover:bg-bg-soft cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full grid place-items-center text-[12px] font-bold flex-none"
                      style={{ background: u.role === 'UNION_ADMIN' ? '#edf7ee' : '#eff6ff', color: u.role === 'UNION_ADMIN' ? '#2a8035' : '#1d4ed8' }}>
                      {u.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-[13.5px] font-bold">
                        {u.name}
                        <span className={clsx('text-[10px] font-extrabold px-1.5 py-0.5 rounded-full',
                          u.role === 'UNION_ADMIN' ? 'bg-[#edf7ee] text-[#2a8035]' : 'bg-[#eff6ff] text-[#1d4ed8]')}>
                          {u.role === 'UNION_ADMIN' ? '운영책임자' : '조합원'}
                        </span>
                        {u.isWithdrawn && <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-danger-bg text-danger">탈퇴</span>}
                      </div>
                      <div className="text-[11.5px] text-fg-muted">{u.loginId} · {u.unionName ?? u.unionId ?? '—'}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 items-center" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setResetTarget(u); setNewPw(''); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] text-fg-muted hover:bg-white hover:text-fg">
                      <KeyRound size={12} /> 비번 초기화
                    </button>
                    {u.isWithdrawn ? (
                      <button onClick={() => setRestoreTarget(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] text-[#2a8035] hover:bg-[#edf7ee]">
                        <RefreshCw size={12} /> 복구
                      </button>
                    ) : (
                      <button onClick={() => setDisableTarget(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] text-danger hover:bg-danger-bg">
                        <Trash2 size={12} /> 비활성화
                      </button>
                    )}
                    <ChevronDown size={14} className={clsx('text-fg-muted transition-transform ml-1', isOpen && 'rotate-180')} />
                  </div>
                </div>

                {/* 상세 패널 */}
                {isOpen && (
                  <div className="bg-bg-soft border-t border-border-soft px-4 py-3 grid grid-cols-3 gap-x-6 gap-y-2.5">
                    {([
                      ['사용자 ID', u.userId],
                      ['아이디(로그인)', u.loginId],
                      ['이름', u.name],
                      ['역할', u.role === 'UNION_ADMIN' ? '운영 책임자' : '조합원'],
                      ['조합', u.unionName ?? u.unionId ?? '—'],
                      ['가입일', new Date(u.createdAt).toLocaleDateString('ko-KR')],
                      ['상태', u.isWithdrawn ? '탈퇴' : '활성'],
                    ] as [string, string][]).map(([label, value]) => (
                      <div key={label}>
                        <div className="text-[10.5px] font-bold text-fg-muted uppercase tracking-wider mb-0.5">{label}</div>
                        <div className="text-[13px] font-semibold text-fg break-all">{value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {disableTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl p-7 w-full max-w-sm">
            <div className="font-extrabold text-[18px] mb-5">계정 비활성화</div>
            <div className="text-[15px] text-fg-muted mb-3">
              <span className="font-bold text-fg">{disableTarget.name}</span> ({disableTarget.loginId}) 계정을 비활성화하시겠습니까?
            </div>
            <div className="text-[13px] text-danger bg-danger-bg rounded-lg px-3 py-2.5 mb-6">
              이 작업은 되돌릴 수 없습니다.
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDisableTarget(null)} className="px-4 py-2.5 rounded-lg text-[14px] text-fg-muted hover:bg-bg-soft">취소</button>
              <button
                onClick={() => { disableUser.mutate(disableTarget.userId); setDisableTarget(null); }}
                disabled={disableUser.isPending}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[14px] font-semibold text-white bg-danger disabled:opacity-50"
              >
                {disableUser.isPending ? '처리 중…' : '비활성화'}
              </button>
            </div>
          </div>
        </div>
      )}

      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl p-7 w-full max-w-sm">
            <div className="font-extrabold text-[18px] mb-5">계정 복구</div>
            <div className="text-[15px] text-fg-muted mb-6">
              <span className="font-bold text-fg">{restoreTarget.name}</span> ({restoreTarget.loginId}) 계정을 다시 활성화하시겠습니까?
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRestoreTarget(null)} className="px-4 py-2.5 rounded-lg text-[14px] text-fg-muted hover:bg-bg-soft">취소</button>
              <button
                onClick={() => { restoreUser.mutate(restoreTarget.userId); setRestoreTarget(null); }}
                disabled={restoreUser.isPending}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[14px] font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#2a8035' }}
              >
                {restoreUser.isPending ? '처리 중…' : '복구'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="font-bold text-[15px] mb-1">비밀번호 초기화</div>
            <div className="text-[13px] text-fg-muted mb-4">{resetTarget.name} ({resetTarget.loginId})</div>
            <input type="password" placeholder="새 임시 비밀번호 (8자 이상)" value={newPw}
              onChange={(e) => setNewPw(e.target.value)} className={INPUT_CLS + ' w-full mb-4'} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setResetTarget(null)} className="px-4 py-2 rounded-lg text-[13px] text-fg-muted hover:bg-bg-soft">취소</button>
              <button onClick={() => resetPw.mutate()} disabled={newPw.length < 8 || resetPw.isPending}
                className={ADMIN_BTN + ' disabled:opacity-50'} style={{ backgroundColor: ADMIN_DEEP }}>
                {resetPw.isPending ? '처리 중…' : '초기화'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 조합 관리 ─────────────────────────────────────── */
function UnionsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: '', name: '' });
  const [expanded, setExpanded] = useState<string | null>(null);

  const unionsQ = useQuery({
    queryKey: ['admin', 'unions'],
    queryFn: () => adminApi.getUnions().then((r) => r.data.data ?? []),
  });
  const unions = unionsQ.data ?? [];

  const createUnion = useMutation({
    mutationFn: () => adminApi.createUnion({ code: form.code, name: form.name, isActive: true }),
    onSuccess: () => {
      toast.success('조합을 생성했습니다');
      setForm({ code: '', name: '' });
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['admin', 'unions'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: () => toast.error('조합 생성 실패'),
  });

  const updateUnion = useMutation({
    mutationFn: ({ unionId, isActive }: { unionId: string; isActive: boolean }) =>
      adminApi.updateUnion(unionId, { isActive }),
    onSuccess: () => {
      toast.success('상태를 변경했습니다');
      qc.invalidateQueries({ queryKey: ['admin', 'unions'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: () => toast.error('상태 변경 실패'),
  });

  return (
    <div className="grid gap-4">
      <section className={cardCls}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[14.5px] font-bold">조합 목록</div>
          <button onClick={() => setShowCreate((v) => !v)} className={ADMIN_BTN} style={{ backgroundColor: ADMIN_DEEP }}>
            <Plus size={14} /> 조합 생성
          </button>
        </div>

        {showCreate && (
          <form onSubmit={(e) => { e.preventDefault(); createUnion.mutate(); }}
            className="border border-border-soft rounded-xl p-4 grid gap-3 bg-bg-soft mb-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="조합코드 (예: ANSEONG)" value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required className={INPUT_CLS} />
              <input type="text" placeholder="조합명 (예: 합천농업법인회사)" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className={INPUT_CLS} />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-[13px] text-fg-muted hover:bg-white">취소</button>
              <button type="submit" disabled={createUnion.isPending} className={ADMIN_BTN} style={{ backgroundColor: ADMIN_DEEP }}>
                {createUnion.isPending ? '생성 중…' : '생성'}
              </button>
            </div>
          </form>
        )}

        {unionsQ.isLoading && <div className="text-center py-8 text-fg-muted text-sm">불러오는 중…</div>}
        {unionsQ.isError && <div className="text-center py-8 text-fg-muted text-sm">조합 목록을 불러오지 못했습니다.</div>}

        <div className="grid gap-2">
          {unions.map((u: AdminUnion) => (
            <div key={u.unionId} className="border border-border-soft rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-bg-soft"
                onClick={() => setExpanded((v) => (v === u.unionId ? null : u.unionId))}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl grid place-items-center flex-none" style={{ background: ADMIN_COLOR + '33' }}>
                    <Building2 size={16} style={{ color: ADMIN_DEEP }} />
                  </div>
                  <div>
                    <div className="text-[14px] font-bold">{u.name}</div>
                    <div className="text-[12px] text-fg-muted">코드: {u.code} · 사용자 {u.userCount ?? 0}명 · 조합원 {u.memberCount ?? 0}명</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx('px-2.5 py-1 rounded-full text-[11px] font-bold',
                    u.isActive ? 'bg-[#edfaf3] text-[#2a8035]' : 'bg-danger-bg text-danger')}>
                    {u.isActive ? '활성' : '비활성'}
                  </span>
                  {expanded === u.unionId ? <ChevronDown size={15} className="text-fg-muted" /> : <ChevronRight size={15} className="text-fg-muted" />}
                </div>
              </div>
              {expanded === u.unionId && (
                <div className="border-t border-border-soft bg-bg-soft">
                  <UnionUsersPanel unionId={u.unionId} />
                  <div className="px-4 py-3 border-t border-border-soft">
                    <button
                      onClick={() => updateUnion.mutate({ unionId: u.unionId, isActive: !u.isActive })}
                      disabled={updateUnion.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold border border-border-soft bg-white hover:bg-bg-soft disabled:opacity-50">
                      {u.isActive ? '비활성화' : '다시 활성화'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── 공지사항 ──────────────────────────────────────── */
function NoticesTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', targetRole: 'ALL' as 'ALL' | 'UNION_ADMIN' | 'MEMBER' });

  const noticesQ = useQuery({
    queryKey: ['admin', 'notices'],
    queryFn: () => adminApi.getNotices().then((r) => r.data.data ?? []),
  });
  const notices = noticesQ.data ?? [];

  const createNotice = useMutation({
    mutationFn: () => adminApi.createNotice(form),
    onSuccess: () => {
      toast.success('공지를 등록했습니다');
      setForm({ title: '', content: '', targetRole: 'ALL' });
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ['admin', 'notices'] });
    },
    onError: () => toast.error('등록 실패'),
  });

  const deleteNotice = useMutation({
    mutationFn: (noticeId: string) => adminApi.deleteNotice(noticeId),
    onSuccess: () => { toast.success('공지를 삭제했습니다'); qc.invalidateQueries({ queryKey: ['admin', 'notices'] }); },
    onError: () => toast.error('삭제 실패'),
  });

  const TARGET_LABELS: Record<string, string> = { ALL: '전체', UNION_ADMIN: '운영 책임자', MEMBER: '조합원' };

  return (
    <div className="grid gap-4">
      <section className={cardCls}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[14.5px] font-bold">시스템 공지</div>
          <button onClick={() => setShowCreate((v) => !v)} className={ADMIN_BTN} style={{ backgroundColor: ADMIN_DEEP }}>
            <Plus size={14} /> 공지 등록
          </button>
        </div>

        {showCreate && (
          <form onSubmit={(e) => { e.preventDefault(); createNotice.mutate(); }}
            className="border border-border-soft rounded-xl p-4 grid gap-3 bg-bg-soft mb-4">
            <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
              <input type="text" placeholder="제목" value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required className={INPUT_CLS} />
              <select value={form.targetRole} onChange={(e) => setForm((f) => ({ ...f, targetRole: e.target.value as typeof form.targetRole }))}
                className={INPUT_CLS}>
                <option value="ALL">전체 대상</option>
                <option value="UNION_ADMIN">운영 책임자</option>
                <option value="MEMBER">조합원</option>
              </select>
            </div>
            <textarea placeholder="공지 내용" value={form.content} rows={3}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} required
              className={INPUT_CLS + ' resize-none w-full'} />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-[13px] text-fg-muted hover:bg-white">취소</button>
              <button type="submit" disabled={createNotice.isPending} className={ADMIN_BTN} style={{ backgroundColor: ADMIN_DEEP }}>
                {createNotice.isPending ? '등록 중…' : '등록'}
              </button>
            </div>
          </form>
        )}

        {noticesQ.isError && <div className="text-center py-8 text-fg-muted text-sm">공지 목록을 불러오지 못했습니다.</div>}
        {notices.length === 0 && !noticesQ.isLoading && !noticesQ.isError && (
          <div className="text-center py-8 text-fg-muted text-sm">등록된 공지가 없습니다.</div>
        )}

        <div className="grid gap-2">
          {notices.map((n: AdminNotice) => (
            <div key={n.noticeId} className="flex items-start justify-between px-4 py-3 border border-border-soft rounded-xl bg-bg-soft">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[14px] font-bold">{n.title}</span>

                </div>
                <p className="text-[13px] text-fg-muted leading-snug">{n.content}</p>
                <span className="text-[11.5px] text-fg-soft mt-1 block">{new Date(n.createdAt).toLocaleString('ko')}</span>
              </div>
              <button onClick={() => deleteNotice.mutate(n.noticeId)} disabled={deleteNotice.isPending}
                className="ml-3 p-1.5 rounded-lg text-fg-muted hover:text-danger hover:bg-danger-bg flex-none">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}


/* ── 조합 사용자 패널 ───────────────────────────────── */
function UnionUsersPanel({ unionId }: { unionId: string }) {
  const usersQ = useQuery({
    queryKey: ['admin', 'users', 'union', unionId],
    queryFn: () => adminApi.getUsers({ size: 100 }).then((r) =>
      (r.data.data ?? []).filter((u) => u.unionId === unionId && u.role !== 'SUPER_ADMIN')
    ),
  });
  const users = usersQ.data ?? [];

  if (usersQ.isLoading) return <div className="px-4 py-3 text-[12.5px] text-fg-muted">불러오는 중…</div>;
  if (users.length === 0) return <div className="px-4 py-3 text-[12.5px] text-fg-muted">등록된 사용자가 없습니다.</div>;

  return (
    <div className="px-4 py-3 grid gap-1.5">
      <div className="text-[11px] font-bold text-fg-muted tracking-wider uppercase mb-1">소속 사용자 ({users.length}명)</div>
      {users.map((u) => (
        <div key={u.userId} className="flex items-center gap-2.5 py-1">
          <div className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold flex-none"
            style={{ background: u.role === 'UNION_ADMIN' ? '#edf7ee' : '#eff6ff', color: u.role === 'UNION_ADMIN' ? '#2a8035' : '#1d4ed8' }}>
            {u.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <span className="text-[13px] font-semibold">{u.name}</span>
            <span className="ml-1.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full"
              style={{ background: u.role === 'UNION_ADMIN' ? '#edf7ee' : '#eff6ff', color: u.role === 'UNION_ADMIN' ? '#2a8035' : '#1d4ed8' }}>
              {u.role === 'UNION_ADMIN' ? '운영책임자' : '조합원'}
            </span>
            {u.isWithdrawn && <span className="ml-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-danger-bg text-danger">탈퇴</span>}
          </div>
          <span className="ml-auto text-[11.5px] text-fg-muted">{u.loginId}</span>
        </div>
      ))}
    </div>
  );
}

/* ── 접속 로그 ─────────────────────────────────────── */
function LogsTab() {
  const [page, setPage] = useState(0);

  const logsQ = useQuery({
    queryKey: ['admin', 'logs', page],
    queryFn: () => adminApi.getLogs({ page, size: 50 }).then((r) => r.data),
  });

  const ACTION_LABEL: Record<string, string> = {
    LOGIN: '로그인', LOGOUT: '로그아웃', PASSWORD_CHANGE: '비번 변경', PROFILE_UPDATE: '프로필 수정',
  };

  return (
    <section className={cardCls}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[14.5px] font-bold">접속 로그</div>
        <button onClick={() => setPage(0)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12.5px] text-fg-muted hover:bg-bg-soft">
          <RefreshCw size={13} /> 새로고침
        </button>
      </div>

      {logsQ.isError && <div className="text-center py-8 text-fg-muted text-sm">로그를 불러오지 못했습니다.</div>}
      {logsQ.isLoading && <div className="text-center py-8 text-fg-muted text-sm">불러오는 중…</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-fg-muted border-b border-border-soft">
              <th className="pb-2 pr-4 font-semibold">시각</th>
              <th className="pb-2 pr-4 font-semibold">아이디</th>
              <th className="pb-2 pr-4 font-semibold">액션</th>
              <th className="pb-2 pr-4 font-semibold">IP</th>
              <th className="pb-2 font-semibold">User Agent</th>
            </tr>
          </thead>
          <tbody>
            {(logsQ.data?.data ?? []).map((log: AdminLog) => (
              <tr key={log.logId} className="border-b border-border-soft hover:bg-bg-soft">
                <td className="py-2 pr-4 text-fg-muted whitespace-nowrap">{new Date(log.createdAt).toLocaleString('ko')}</td>
                <td className="py-2 pr-4 font-semibold">{log.loginId ?? log.userId ?? '—'}</td>
                <td className="py-2 pr-4">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: ADMIN_COLOR + '33', color: ADMIN_DEEP }}>
                    {ACTION_LABEL[log.action] ?? log.action}
                  </span>
                </td>
                <td className="py-2 pr-4 text-fg-muted font-mono text-[12px]">{log.ipAddress ?? '—'}</td>
                <td className="py-2 text-fg-muted text-[11px] truncate max-w-[200px]">{log.userAgent ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(logsQ.data?.totalElements ?? 0) > 50 && (
        <div className="flex justify-center gap-2 mt-3">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-[13px] border border-border-soft disabled:opacity-40 hover:bg-bg-soft">이전</button>
          <button onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-[13px] border border-border-soft hover:bg-bg-soft">다음</button>
        </div>
      )}
    </section>
  );
}
