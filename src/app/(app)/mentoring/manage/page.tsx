'use client';

import { toast } from 'sonner';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, X } from 'lucide-react';
import { PageHead, cardCls } from '@/components/shared/PageHead';
import { RoleGuard } from '@/components/shared/RoleGuard';
import { mentoringApi } from '@/lib/api/mentoring';

const STATUS_LABEL: Record<string, string> = {
  PENDING: '승인 대기', APPROVED: '승인됨', ACTIVE: '진행중', COMPLETED: '완료', REJECTED: '거절됨',
};
const STATUS_PILL: Record<string, string> = {
  PENDING: 'bg-warn-bg text-warn', APPROVED: 'bg-info-bg text-info', ACTIVE: 'bg-brand-soft text-brand-deep',
  COMPLETED: 'bg-group-top-bg text-group-top', REJECTED: 'bg-group-low-bg text-group-low',
};

type Filter = 'PENDING' | 'ACTIVE' | 'ALL';

export default function MentoringManagePage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('PENDING');

  const statsQ = useQuery({
    queryKey: ['mentoring', 'stats'],
    queryFn: () => mentoringApi.getStats().then((r) => r.data.data),
  });
  const matchesQ = useQuery({
    queryKey: ['mentoring', 'matches'],
    queryFn: () => mentoringApi.getMatches().then((r) => r.data.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['mentoring', 'matches'] });
    qc.invalidateQueries({ queryKey: ['mentoring', 'stats'] });
  };
  const approve = useMutation({
    mutationFn: (matchId: string) => mentoringApi.approveMatch(matchId),
    onSuccess: () => { invalidate(); toast.success('매칭을 승인했습니다'); },
    onError: () => toast.error('승인에 실패했습니다'),
  });
  const reject = useMutation({
    mutationFn: (matchId: string) => mentoringApi.rejectMatch(matchId),
    onSuccess: () => { invalidate(); toast.success('매칭을 거절했습니다'); },
    onError: () => toast.error('거절에 실패했습니다'),
  });
  const busy = approve.isPending || reject.isPending;

  const st = statsQ.data;
  const STATS = [
    { k: '승인 대기', v: st ? String(st.pending) : '—', color: '#d97706', bg: '#fffbeb', borderColor: '#fde68a' },
    { k: '진행중', v: st ? String(st.active) : '—', color: '#16a34a', bg: '#f0fdf4', borderColor: '#bbf7d0' },
    { k: '완료', v: st ? String(st.completed) : '—', color: '#2563eb', bg: '#eff6ff', borderColor: '#dbeafe' },
    { k: '멘토 가용', v: st ? String(st.availableMentors) : '—', color: '#374151', bg: '#f9fafb', borderColor: '#e5e7eb' },
  ];

  const all = matchesQ.data ?? [];
  const list = all.filter((m) =>
    filter === 'ALL' ? true : filter === 'PENDING' ? m.status === 'PENDING' : m.status === 'ACTIVE' || m.status === 'APPROVED'
  );

  return (
    <RoleGuard allow={['UNION_ADMIN']}>
      <PageHead title="멘토링 승인 관리" description="조합원이 요청한 멘토링 매칭을 검토하고 승인·거절합니다." />

      <div className="grid grid-cols-4 max-[1180px]:grid-cols-2 max-[720px]:grid-cols-1 gap-3 mb-3.5">
        {STATS.map((s) => (
          <div key={s.k} className="rounded-xl px-4 py-3.5 flex flex-col gap-1 border border-l-4" style={{ background: s.bg, borderColor: s.borderColor, borderLeftColor: s.color }}>
            <span className="text-[11.5px] text-fg-muted font-bold tracking-wider uppercase">{s.k}</span>
            <span className="text-[22px] font-extrabold tracking-tight" style={{ color: s.color }}>{s.v}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-border-soft mb-3.5">
        {([['PENDING', '승인 대기'], ['ACTIVE', '진행중'], ['ALL', '전체']] as Array<[Filter, string]>).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={clsx('px-4 py-2.5 font-bold text-[13.5px] -mb-px border-b-2', filter === k ? 'text-brand-deep border-brand' : 'text-fg-muted border-transparent')}>
            {label}
          </button>
        ))}
      </div>

      {matchesQ.isLoading && <div className="text-center py-16 text-fg-muted text-sm">불러오는 중…</div>}
      {!matchesQ.isLoading && list.length === 0 && (
        <div className="text-center py-16 text-fg-muted text-sm">{filter === 'PENDING' ? '승인 대기 중인 매칭이 없습니다.' : '해당하는 매칭이 없습니다.'}</div>
      )}

      <div className="grid grid-cols-2 max-[820px]:grid-cols-1 gap-3">
        {list.map((m) => {
          const pct = m.taskCount > 0 ? Math.round((m.completedTaskCount / m.taskCount) * 100) : 0;
          return (
            <article key={m.matchId} className={cardCls}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-bold text-[14px]">멘토 {m.mentorName} <span className="text-fg-muted font-normal">↔ {m.menteeName}</span></div>
                <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-extrabold flex-none', STATUS_PILL[m.status] ?? 'bg-bg-soft text-fg-soft')}>
                  {STATUS_LABEL[m.status] ?? m.status}
                </span>
              </div>
              {m.goal && <div className="text-[12.5px] text-fg-soft mb-2">목표 · {m.goal}</div>}
              {m.helpAreas.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-3">
                  {m.helpAreas.map((h) => <span key={h} className="px-2 py-0.5 bg-bg-soft rounded-full text-[11px] text-fg-soft font-semibold">{h}</span>)}
                </div>
              )}

              {m.status === 'PENDING' ? (
                <div className="flex gap-1.5 mt-1">
                  <button type="button" disabled={busy} onClick={() => approve.mutate(m.matchId)} className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-brand text-white font-bold text-[13px] hover:bg-brand-deep disabled:opacity-50">
                    <Check size={15} /> 승인
                  </button>
                  <button type="button" disabled={busy} onClick={() => reject.mutate(m.matchId)} className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-border-soft text-fg-soft font-bold text-[13px] hover:bg-bg-soft disabled:opacity-50">
                    <X size={15} /> 거절
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11.5px] text-fg-muted mb-1">
                    <span>공동 과제</span>
                    <span className="font-bold text-fg">{m.completedTaskCount}/{m.taskCount}</span>
                  </div>
                  <div className="relative h-2 bg-bg-soft rounded-full overflow-hidden">
                    <div className="absolute inset-0 right-auto rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </RoleGuard>
  );
}
