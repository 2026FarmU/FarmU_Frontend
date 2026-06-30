'use client';

import { toast } from 'sonner';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { PageHead, cardCls, btnSmCls, chipCls, chipOnCls } from '@/components/shared/PageHead';
import { useAuthStore } from '@/lib/store/authStore';
import { shippingApi } from '@/lib/api/shipping';
import { membersApi } from '@/lib/api/members';
import type { ShippingAction } from '@/types/shipping';
import { ChevronDown, X, Trash2 } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

type Badge = 'ship' | 'hold' | 'split';
const BADGE_CLS: Record<Badge, string> = {
  ship:   'bg-[#ecfdf3] text-[#16a34a] border border-[#bbf7d0]', // 출하 — 초록(권장)
  hold:   'bg-[#fffbeb] text-[#d97706] border border-[#fde68a]', // 보류 — 주황(대기)
  split:  'bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]', // 분할 — 파랑
};
const BADGE_LABEL: Record<Badge, string> = { ship: '출하', hold: '보류', split: '분할' };

interface Reco {
  id: string;
  badge: Badge; title: string; owner: string; ownerInit: string; date: string; conf: number;
  overdue?: boolean;
  decided?: 'ACCEPTED' | 'REJECTED';
  rev: { min: string; exp: string; max: string };
  risks: string[];
  reasons: string[];
}

const ACTION_BADGE: Partial<Record<ShippingAction, Badge>> = {
  SHIP: 'ship', HOLD: 'hold', SPLIT_SHIP: 'split',
};
const krw = (v: number) => `₩ ${v.toLocaleString('ko-KR')}`;
// 최근 6개월 yyyy-MM 윈도우
const monthWindow = () => {
  const now = new Date();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const f = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const from = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
  return { from, to };
};
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ShippingPage() {
  const role = useAuthStore((s) => s.user?.role);
  const unionId = useAuthStore((s) => s.user?.unionId) ?? '';
  const isAdmin = role === 'UNION_ADMIN';
  const accent = isAdmin ? '#41AA4D' : '#2563eb';
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [selMember, setSelMember] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>('all');
  const [actionFilter, setActionFilter] = useState<'all' | ShippingAction>('all');
  const [livestockModal, setLivestockModal] = useState(false);
  const [pendingReject, setPendingReject] = useState<{ id: string; crop: string } | null>(null);
  const [showRejectAllConfirm, setShowRejectAllConfirm] = useState(false);
  const [lvForm, setLvForm] = useState({ livestockId: '', currentWeight: '', targetWeight: '', baseRevenue: '' });
  const qc = useQueryClient();

  // 실제 조합원 목록 (전체 조합원 picker + 추천 소유자 이름 매핑)
  const membersQ = useQuery({
    queryKey: ['members', 'ranking', unionId],
    queryFn: () => membersApi.getRanking({ unionId, period: '2026-05', size: 200 }).then((r) => r.data.data),
    enabled: isAdmin && !!unionId,
  });
  const members = membersQ.data ?? [];
  const memberName = (id: string) => members.find((m) => m.memberId === id)?.name ?? id;

  const recosQ = useQuery({
    queryKey: ['shipping', 'recommendations', unionId, isAdmin, statusFilter],
    queryFn: () =>
      shippingApi.getRecommendations({
        ...(isAdmin ? { unionId } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      }).then((r) => r.data.data),
    enabled: !!unionId,
  });
  const { from, to } = monthWindow();
  const accQ = useQuery({
    queryKey: ['shipping', 'accuracy', unionId, from, to],
    queryFn: () => shippingApi.getAccuracy({ unionId, from, to }).then((r) => r.data.data),
    enabled: !!unionId,
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'ACCEPTED' | 'REJECTED' }) =>
      shippingApi.submitDecision(id, decision === 'ACCEPTED' ? { decision, actualShipDate: todayStr() } : { decision }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['shipping', 'recommendations', unionId, isAdmin] });
      v.decision === 'ACCEPTED' ? toast.success('출하 권고를 채택했습니다') : toast.success('권고를 거절했습니다');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { properties?: { code?: string }; detail?: string } } };
      const code = e.response?.data?.properties?.code;
      if (code === 'RECOMMENDATION_ALREADY_DECIDED') {
        toast.error('이미 처리된 추천입니다. 목록을 새로고침합니다.');
        qc.invalidateQueries({ queryKey: ['shipping', 'recommendations', unionId, isAdmin] });
        return;
      }
      toast.error(e.response?.data?.detail ?? '처리에 실패했습니다');
    },
  });

  const registerLivestock = useMutation({
    mutationFn: () => shippingApi.registerLivestock({
      livestockId: lvForm.livestockId.trim(),
      currentWeight: Number(lvForm.currentWeight),
      targetWeight: Number(lvForm.targetWeight),
      baseRevenue: Math.round(Number(lvForm.baseRevenue) * 10000),
      observedAt: todayStr(),
    }),
    onSuccess: () => {
      toast.success('출하 데이터를 등록했습니다. AI 추천을 생성하는 중입니다…');
      setLivestockModal(false);
      setLvForm({ livestockId: '', currentWeight: '', targetWeight: '', baseRevenue: '' });
      qc.invalidateQueries({ queryKey: ['shipping', 'recommendations'] });
    },
    onError: () => toast.error('출하 데이터 등록에 실패했습니다'),
  });

  const today = todayStr();
  const RECOS: Reco[] = (recosQ.data ?? []).filter((r) => r.recommendedDate >= today).map((r) => ({
    id: r.id,
    badge: ACTION_BADGE[r.recommendedAction] ?? 'hold',
    title: `${r.livestockId} · ${r.currentWeight}kg`,
    owner: r.memberId,
    ownerInit: r.memberId.slice(0, 1).toUpperCase(),
    date: r.recommendedDate,
    conf: Math.round(r.confidence * 100),
    overdue: r.recommendedDate < today,
    decided: r.status && r.status !== 'PENDING' ? r.status : undefined,
    rev: { min: krw(r.expectedRevenue.min), exp: krw(r.expectedRevenue.expected), max: krw(r.expectedRevenue.max) },
    risks: r.riskFactors.map((rf) => rf.note ?? rf.type),
    reasons: r.rationale ? [r.rationale] : [],
  }));
  const ACC = (accQ.data?.monthly ?? []).map((mo) => ({ m: mo.period.slice(2), acc: mo.hitRate }));
  const shown = RECOS
    .filter((r) => selMember === 'all' || r.owner === selMember)
    .filter((r) => actionFilter === 'all' || r.badge === ACTION_BADGE[actionFilter])
    .filter((r) => {
      if (statusFilter === 'all') return r.decided !== 'REJECTED';
      if (statusFilter === 'PENDING') return !r.decided;
      return r.decided === statusFilter;
    });
  const pendingShown = shown.filter((r) => !r.decided);
  const overdueCount = shown.filter((r) => r.overdue).length;

  return (
    <>
      <PageHead
        title="출하 추천"
        description={
          isAdmin
            ? '조합원 전체 출하 권고를 검토하고 적중률을 관리합니다.'
            : 'AI가 추천하는 출하 시점과 이유를 확인하고, 직접 채택하거나 보류할 수 있습니다.'
        }
      />

      {isAdmin && (
        <div className="bg-white border border-border-soft border-l-4 border-l-brand rounded-xl px-4.5 py-3.5 mb-3.5 flex items-center gap-3.5 flex-wrap">
          <span className="text-[11px] text-fg-muted font-bold tracking-wider uppercase">조합원</span>
          <div className="relative">
            <select
              value={selMember}
              onChange={(e) => setSelMember(e.target.value)}
              className="appearance-none bg-bg-soft border border-border-soft text-fg pl-3.5 pr-8 py-1.5 rounded-lg font-bold text-[13.5px] hover:bg-brand-soft hover:border-brand cursor-pointer"
            >
              <option value="all">전체 조합원 ({members.length}명)</option>
              {members.map((m) => (
                <option key={m.memberId} value={m.memberId}>{m.name}</option>
              ))}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          </div>
          <div className="flex gap-5.5 ml-auto flex-wrap items-center">
            {([
              ['전체 추천', `${shown.length}건`, false, false],
              ['대기', `${shown.length}건`, false, false],
              ['이번 달 채택률', accQ.data ? `${accQ.data.overallHitRate}%` : '—', false, true],
              ['권고일 경과', `${overdueCount}건`, overdueCount > 0, false],
            ] as Array<[string, string, boolean, boolean]>).map(([k, v, alert, center]) => (
              <div key={k} className="flex flex-col gap-0.5 items-center text-center">
                <span className="text-[10.5px] text-fg-muted font-bold tracking-wider uppercase">{k}</span>
                <span className={clsx('text-lg font-extrabold tracking-tight', alert ? 'text-danger' : 'text-fg', center && 'text-center')}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 조합원: 경축 데이터 등록 버튼 */}
      {!isAdmin && (
        <div className="bg-white border border-border-soft border-l-4 border-l-brand rounded-xl px-4.5 py-3.5 mb-3.5 flex items-center justify-between gap-3.5">
          <div>
            <div className="text-[13.5px] font-bold">출하 데이터 등록</div>
            <div className="text-[12px] text-fg-muted mt-0.5">경종·축산 데이터를 입력하면 AI가 최적 출하 시점을 추천합니다</div>
          </div>
          <button
            type="button"
            onClick={() => setLivestockModal(true)}
            className="flex-none px-4 py-2 rounded-[10px] bg-brand text-white font-bold text-[13.5px] hover:bg-brand-deep"
          >
            + 데이터 등록
          </button>
        </div>
      )}

      {/* 적중률 */}
      <section className={`${cardCls} mb-3.5`}>
        <div className="mb-3.5">
          <div className="text-[14.5px] font-bold">출하 적중률{isAdmin ? ' 추이' : ''}</div>
          <div className="text-[12.5px] text-fg-muted">월별 권고 적중률</div>
        </div>
        <div className="h-55">
          {ACC.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-fg-muted">
              <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="opacity-30"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 11v6m4-9v9m4-5v5" /></svg>
              <span className="text-[13px]">적중률 데이터가 없습니다</span>
              <span className="text-[11.5px] opacity-60">출하 추천이 채택되면 다음 달부터 집계됩니다</span>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ACC} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="#ececec" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="m" tick={{ fill: '#8c918d', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={[50, 100]} tick={{ fill: '#8c918d', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 8, border: '1px solid #ececec', fontSize: 12 }} />
              <Bar dataKey="acc" fill={accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* 필터 */}
      <div className="bg-white border border-border-soft rounded-xl p-3 mb-3.5 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {([['all', '전체'], ['PENDING', '대기'], ['ACCEPTED', '채택'], ['REJECTED', '거절']] as Array<['all' | 'PENDING' | 'ACCEPTED' | 'REJECTED', string]>).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setStatusFilter(k)} className={statusFilter === k ? chipOnCls : chipCls}>
              {label}
            </button>
          ))}
          <span className="w-px h-4.5 bg-border-soft mx-1" />
          {([['SHIP', '출하'], ['HOLD', '보류'], ['SPLIT_SHIP', '분할']] as Array<[ShippingAction, string]>).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setActionFilter((cur) => (cur === k ? 'all' : k))} className={actionFilter === k ? chipOnCls : chipCls}>
              {label}
            </button>
          ))}
        </div>
        {pendingShown.length > 1 && (
          <button
            type="button"
            onClick={() => setShowRejectAllConfirm(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold text-danger hover:bg-danger-bg transition-colors border border-transparent hover:border-danger/20 flex-none ml-auto"
          >
            <Trash2 size={12} />전체 거절
          </button>
        )}
      </div>

      {/* 추천 리스트 */}
      <div className="flex flex-col gap-2">
        {recosQ.isLoading && (
          <div className="bg-white border border-border-soft rounded-[10px] px-4 py-8 text-center text-[13px] text-fg-muted">불러오는 중…</div>
        )}
        {!recosQ.isLoading && shown.length === 0 && (
          <div className="bg-white border border-border-soft rounded-[10px] px-4 py-8 text-center text-[13px] text-fg-muted">
            {recosQ.isError ? '추천을 불러오지 못했습니다.' : '표시할 출하 추천이 없습니다.'}
          </div>
        )}
        {shown.map((r, i) => {
          const open = openIdx === i;
          return (
            <div key={r.id} className={clsx('bg-white border border-border-soft rounded-[10px] transition-all', open && 'pb-3')}>
              <div
                onClick={() => setOpenIdx(open ? null : i)}
                className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3.5 items-center px-4 py-3 cursor-pointer max-md:grid-cols-1"
              >
                <span className={clsx('inline-flex px-2.5 py-1 rounded-md font-extrabold text-[11.5px]', BADGE_CLS[r.badge])}>
                  {BADGE_LABEL[r.badge]}
                </span>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <span className="w-6.5 h-6.5 rounded-full bg-brand-soft text-brand-deep grid place-items-center font-extrabold text-[10.5px]">{memberName(r.owner).slice(0, 1)}</span>
                    <span className="text-[12.5px] font-bold">{memberName(r.owner)}</span>
                  </div>
                )}
                <div>
                  <div className="font-bold text-[13.5px]">
                    {r.title}
                    {r.overdue && <span className="ml-1.5 bg-group-low-bg text-group-low px-2 py-0.5 rounded-md text-[10.5px] font-extrabold">권고일 경과</span>}
                  </div>
                  <div className="text-[11.5px] text-fg-muted mt-0.5">권고일 {r.date}{!isAdmin && ` · ${r.owner}`}</div>
                </div>
                <span className="text-xs text-fg-soft whitespace-nowrap">신뢰도 <b className="text-fg font-extrabold">{r.conf}%</b></span>
                <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {r.decided ? (
                    <span className={clsx(
                      'inline-flex items-center px-2.5 py-1.5 rounded-md font-bold text-[12.5px]',
                      r.decided === 'ACCEPTED' ? 'bg-brand-soft text-brand-deep' : 'bg-bg-soft text-fg-muted',
                    )}>
                      {r.decided === 'ACCEPTED' ? '채택됨' : '거절됨'}
                    </span>
                  ) : !r.overdue ? (
                    <>
                      <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: 'ACCEPTED' })} className="px-2.5 py-1.5 rounded-md bg-brand text-white font-semibold text-[12.5px] hover:bg-brand-deep disabled:opacity-50">채택</button>
                      <button type="button" disabled={decide.isPending} onClick={() => setPendingReject({ id: r.id, crop: r.title ?? '출하 권고' })} className="px-2.5 py-1.5 rounded-md border border-border-soft text-danger font-semibold text-[12.5px] hover:bg-danger-bg disabled:opacity-50">거절</button>
                    </>
                  ) : (
                    <button type="button" disabled={decide.isPending} className={btnSmCls} onClick={() => decide.mutate({ id: r.id, decision: 'ACCEPTED' })}>채택</button>
                  )}
                </div>
                <button type="button" aria-label={open ? '상세 접기' : '상세 펼치기'} className="w-7 h-7 rounded-md border border-border-soft bg-white text-fg-muted hover:bg-bg-soft grid place-items-center">
                  <ChevronDown size={15} className={clsx('transition-transform', open && 'rotate-180')} />
                </button>
              </div>

              {open && (
                <div className="grid grid-cols-[1.1fr_1fr_1fr] max-md:grid-cols-1 gap-4.5 mx-4 pt-3.5 border-t border-border-soft">
                  <div>
                    <div className="text-[12.5px] text-fg-muted mb-1.5">예상 수익</div>
                    <div className="grid gap-1.5">
                      <div className="flex justify-between text-[13px]"><span className="text-fg-muted">하한</span><span>{r.rev.min}</span></div>
                      <div className="flex justify-between text-[13px]"><span className="text-fg-muted">예상</span><span className="text-brand-deep font-extrabold text-sm">{r.rev.exp}</span></div>
                      <div className="flex justify-between text-[13px]"><span className="text-fg-muted">상한</span><span>{r.rev.max}</span></div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[12.5px] text-fg-muted mb-1.5">위험 요인</div>
                    <ul className="text-[13px] text-fg-soft pl-4.5 list-disc marker:text-warn">
                      {r.risks.map((x) => <li key={x}>{x}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[12.5px] text-fg-muted mb-1.5">추천 근거</div>
                    <ul className="text-[13px] text-fg-soft pl-4.5 list-disc marker:text-brand">
                      {r.reasons.map((x) => <li key={x}>{x}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* 경축 데이터 등록 모달 */}
      {livestockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" onClick={() => setLivestockModal(false)}>
          <div className="bg-white rounded-2xl border border-border-soft w-[440px] max-w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-[16px] font-extrabold mb-1">출하 데이터 등록</div>
            <div className="text-[12.5px] text-fg-muted mb-5">경종·축산 데이터를 등록하면 AI가 최적 출하 시점과 예상 수익을 자동으로 분석합니다.</div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-fg-soft mb-1.5">개체/품목 번호</label>
                <input
                  value={lvForm.livestockId}
                  onChange={(e) => setLvForm(f => ({ ...f, livestockId: e.target.value }))}
                  placeholder="예: cow_001 / crop_A"
                  className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft text-[13.5px] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-fg-soft mb-1.5">현재 중량 (kg)</label>
                <input
                  type="number"
                  value={lvForm.currentWeight}
                  onChange={(e) => setLvForm(f => ({ ...f, currentWeight: e.target.value }))}
                  placeholder="예: 620"
                  className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft text-[13.5px] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-fg-soft mb-1.5">목표 중량 (kg)</label>
                <input
                  type="number"
                  value={lvForm.targetWeight}
                  onChange={(e) => setLvForm(f => ({ ...f, targetWeight: e.target.value }))}
                  placeholder="예: 680"
                  className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft text-[13.5px] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-fg-soft mb-1.5">기준 수익 (만원)</label>
                <input
                  type="number"
                  value={lvForm.baseRevenue}
                  onChange={(e) => setLvForm(f => ({ ...f, baseRevenue: e.target.value }))}
                  placeholder="예: 300 (= 300만원)"
                  className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft text-[13.5px] focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setLivestockModal(false)} className="flex-1 py-2.5 rounded-[10px] border border-border-soft bg-white text-fg font-bold text-[14px] hover:bg-bg-soft">취소</button>
              <button
                type="button"
                disabled={!lvForm.livestockId.trim() || !lvForm.currentWeight || !lvForm.targetWeight || !lvForm.baseRevenue || registerLivestock.isPending}
                onClick={() => registerLivestock.mutate()}
                className="flex-1 py-2.5 rounded-[10px] bg-brand text-white font-bold text-[14px] hover:bg-brand-deep disabled:opacity-50"
              >
                {registerLivestock.isPending ? 'AI 분석 중…' : 'AI 추천 받기'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showRejectAllConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col items-center px-8 pt-8 pb-7 gap-5">
            <div className="w-16 h-16 rounded-full bg-[#fdecec] flex items-center justify-center">
              <Trash2 size={28} className="text-[#d23f3f]" />
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="font-extrabold text-[17px]">출하 권고 전체 거절</h2>
              <p className="text-[13px] text-fg-muted leading-relaxed">
                대기 중인 <strong className="text-[#d23f3f]">{pendingShown.length}건</strong>을 모두 거절합니다.<br />이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setShowRejectAllConfirm(false)}
                className="flex-1 py-3.5 rounded-2xl border border-[#e5e7e0] text-[14px] font-semibold text-fg hover:bg-[#f4f6f8] transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  Promise.all(pendingShown.map((r) => shippingApi.submitDecision(r.id, { decision: 'REJECTED' })))
                    .then(() => { qc.invalidateQueries({ queryKey: ['shipping', 'recommendations', unionId, isAdmin] }); toast.success('전체 거절했습니다'); setShowRejectAllConfirm(false); })
                    .catch(() => toast.error('일부 처리에 실패했습니다'));
                }}
                disabled={decide.isPending}
                className="flex-1 py-3.5 rounded-2xl bg-[#d23f3f] hover:bg-[#b83535] text-white text-[14px] font-semibold transition-colors disabled:opacity-60"
              >
                전체 거절
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingReject && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col items-center px-8 pt-8 pb-7 gap-5">
            <div className="w-16 h-16 rounded-full bg-[#fdecec] flex items-center justify-center">
              <Trash2 size={28} className="text-[#d23f3f]" />
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="font-extrabold text-[17px]">출하 권고 거절</h2>
              <p className="text-[13px] text-fg-muted leading-relaxed">
                <strong className="text-[#d23f3f]">{pendingReject.crop}</strong> 권고를 거절합니다.<br />이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setPendingReject(null)}
                className="flex-1 py-3.5 rounded-2xl border border-[#e5e7e0] text-[14px] font-semibold text-fg hover:bg-[#f4f6f8] transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  decide.mutate({ id: pendingReject.id, decision: 'REJECTED' });
                  setPendingReject(null);
                }}
                disabled={decide.isPending}
                className="flex-1 py-3.5 rounded-2xl bg-[#d23f3f] hover:bg-[#b83535] text-white text-[14px] font-semibold transition-colors disabled:opacity-60"
              >
                거절
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
