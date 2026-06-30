'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, X, Clock, CheckCircle2, XCircle, Star, MapPin, Sprout,
  MessageSquarePlus, TrendingUp, Info, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { PageHead, btnPrimaryCls } from '@/components/shared/PageHead';
import { mentoringApi } from '@/lib/api/mentoring';
import { membersApi } from '@/lib/api/members';
import { usersApi } from '@/lib/api/users';
import type { MentorCandidate } from '@/types/mentoring';
import { useAuthStore } from '@/lib/store/authStore';
import { useMe } from '@/lib/hooks/useMe';

const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const STATUS_META = {
  PENDING:   { label: '승인 대기', color: 'bg-amber-50 text-amber-700',  icon: Clock },
  ACTIVE:    { label: '진행 중',   color: 'bg-green-50 text-green-700',  icon: CheckCircle2 },
  COMPLETED: { label: '완료',      color: 'bg-gray-100 text-gray-500',   icon: CheckCircle2 },
  REJECTED:  { label: '거절됨',    color: 'bg-red-50 text-red-500',      icon: XCircle },
} as const;

function MentorDetailPopup({ mentorId, menteeId, onClose }: { mentorId: string; menteeId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['mentoring', 'mentor-detail', mentorId, menteeId],
    queryFn: () => mentoringApi.getSuggestionDetail(mentorId, menteeId).then((r) => r.data.data),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#e5e7e0] sticky top-0 bg-white">
          <div className="font-extrabold text-[15px]">멘토 상세</div>
          <button onClick={onClose}><X size={16} className="text-fg-muted" /></button>
        </div>
        <div className="px-5 py-4">
          {isLoading ? (
            <div className="text-[13px] text-fg-muted text-center py-6">불러오는 중…</div>
          ) : data && (
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-[17px] font-extrabold">{data.name}</div>
                <div className="text-[12.5px] text-fg-muted mt-0.5">
                  {data.crop} · {data.region}{data.distanceKm > 0 ? ` · ${data.distanceKm.toFixed(0)}km` : ''}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([['멘토 점수', data.mentorScore.toFixed(1)], ['매칭 점수', data.matchScore.toFixed(1)], ['경력', `${data.years}년`]] as [string,string][]).map(([k, v]) => (
                  <div key={k} className="bg-[#f5f6f4] rounded-xl p-3 text-center">
                    <div className="text-[11px] text-fg-muted">{k}</div>
                    <div className="text-[16px] font-extrabold text-brand-deep">{v}</div>
                  </div>
                ))}
              </div>
              {data.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.tags.map((t) => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-brand-soft text-brand-deep font-semibold">{t}</span>
                  ))}
                </div>
              )}
              {data.reason && <p className="text-[12.5px] text-fg-muted leading-relaxed">{data.reason}</p>}
              {data.matchFactors.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11.5px] font-bold text-fg-muted">매칭 요인</div>
                  {data.matchFactors.map((f) => (
                    <div key={f.factor} className="flex items-center justify-between text-[12.5px]">
                      <span>{f.factor}</span>
                      <span className="font-bold text-brand-deep">{f.score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
              {data.comparison.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="text-[11.5px] font-bold text-fg-muted">멘토와 비교</div>
                  {data.comparison.map((c) => (
                    <div key={c.category} className="grid grid-cols-3 gap-2 text-[12px] border border-[#e5e7e0] rounded-xl px-3 py-2">
                      <span className="text-fg-muted">{c.category}</span>
                      <span className="text-center text-fg-muted">{c.menteeScore}</span>
                      <span className="text-right font-bold text-brand-deep">{c.mentorScore}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestModal({ onClose, menteeId, pendingMentorIds }: { onClose: () => void; menteeId: string; pendingMentorIds: Set<string> }) {
  const qc = useQueryClient();
  const [detailMentor, setDetailMentor] = useState<string | null>(null);

  const suggestionsQ = useQuery({
    queryKey: ['mentoring', 'suggestions', menteeId],
    queryFn: () => mentoringApi.getSuggestions({ menteeId, size: 5 }).then((r) => r.data.data ?? []),
  });

  const requestMatch = useMutation({
    mutationFn: (mentorId: string) =>
      mentoringApi.requestMatch({ menteeId, mentorId, goal: '멘토링 신청', helpAreas: [] }),
    onSuccess: () => {
      toast.success('멘토링 신청이 완료되었습니다');
      qc.invalidateQueries({ queryKey: ['mentoring', 'matches', 'my'] });
      qc.invalidateQueries({ queryKey: ['mentoring', 'stats'] });
      onClose();
    },
    onError: () => toast.error('신청에 실패했습니다'),
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#e5e7e0] shrink-0">
            <h2 className="font-extrabold text-[15px]">멘토링 신청</h2>
            <button type="button" onClick={onClose}><X size={18} className="text-fg-muted" /></button>
          </div>
          <div className="px-6 py-4 overflow-y-auto flex-1">
            {suggestionsQ.isLoading ? (
              <div className="py-10 text-center text-[13px] text-fg-muted">추천 멘토 불러오는 중…</div>
            ) : !suggestionsQ.data?.length ? (
              <div className="py-10 text-center text-[13px] text-fg-muted">추천 멘토가 없습니다</div>
            ) : (
              <div className="flex flex-col gap-3">
                {suggestionsQ.data.map((s) => {
                  const alreadyPending = pendingMentorIds.has(s.mentorId);
                  return (
                    <div key={s.mentorId} className="border border-[#e5e7e0] rounded-xl p-4 flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-[14px]">{s.name}</span>
                            <button onClick={() => setDetailMentor(s.mentorId)} className="text-fg-muted hover:text-fg">
                              <Info size={12} />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-fg-muted flex-wrap">
                            <span className="flex items-center gap-1"><Sprout size={10} />{s.crop}</span>
                            <span className="flex items-center gap-1"><MapPin size={10} />{s.region}</span>
                            {s.distanceKm > 0 && <span>{s.distanceKm.toFixed(0)}km</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-none">
                          <div className="flex items-center gap-1">
                            <Star size={11} className="text-amber-400 fill-amber-400" />
                            <span className="text-[12px] font-extrabold">{s.mentorScore.toFixed(1)}</span>
                          </div>
                          <span className="text-[10.5px] text-fg-muted">매칭 {s.matchScore.toFixed(0)}%</span>
                        </div>
                      </div>
                      {s.helpAreas.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {s.helpAreas.map((a) => (
                            <span key={a} className="text-[11px] px-2 py-0.5 rounded-full bg-brand-soft text-brand-deep font-semibold">{a}</span>
                          ))}
                        </div>
                      )}
                      {s.matchReasons[0] && (
                        <p className="text-[11.5px] text-fg-muted leading-snug">{s.matchReasons[0]}</p>
                      )}
                      <button
                        onClick={() => requestMatch.mutate(s.mentorId)}
                        disabled={requestMatch.isPending || alreadyPending}
                        className={clsx(
                          'flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12.5px] font-bold transition-colors disabled:opacity-50',
                          alreadyPending
                            ? 'bg-amber-50 text-amber-700 cursor-default'
                            : 'bg-brand hover:bg-brand-deep text-white',
                        )}
                      >
                        {alreadyPending ? (
                          <><Clock size={12} />신청 대기 중</>
                        ) : (
                          <><MessageSquarePlus size={12} />신청하기</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {detailMentor && (
        <MentorDetailPopup
          mentorId={detailMentor}
          menteeId={menteeId}
          onClose={() => setDetailMentor(null)}
        />
      )}
    </>
  );
}

export default function MentoringPage() {
  const user = useAuthStore((s) => s.user);
  const { data: me } = useMe();
  const profileQ = useQuery({
    queryKey: ['users', 'me-profile'],
    queryFn: () => usersApi.me().then((r) => r.data.data),
    staleTime: 1000 * 60 * 5,
  });
  const myMemberId = me?.memberId ?? profileQ.data?.memberId ?? '';
  const unionId = user?.unionId ?? '';
  const prevPeriod = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [detailMentor, setDetailMentor] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [filterOpen, setFilterOpen] = useState(false);

  const statsQ = useQuery({
    queryKey: ['mentoring', 'stats'],
    queryFn: () => mentoringApi.getStats().then((r) => r.data.data),
  });

  const rankingQ = useQuery({
    queryKey: ['members', 'ranking', unionId, prevPeriod],
    queryFn: () =>
      membersApi.getRanking({ unionId, period: prevPeriod, size: 200 })
        .then((r) => r.data.data ?? []),
    enabled: !!unionId,
    staleTime: 1000 * 60 * 10,
  });
  const mentorInfoMap = new Map(
    (rankingQ.data ?? []).map((m) => [m.memberId, { mainCrop: m.mainCrop, region: m.region }])
  );

  const myMatchesQ = useQuery({
    queryKey: ['mentoring', 'matches', 'my'],
    queryFn: () => mentoringApi.getMatches().then((r) => r.data.data ?? []),
    enabled: !!myMemberId,
  });

  const cancelMatch = useMutation({
    mutationFn: (matchId: string) => mentoringApi.cancelMatch(matchId),
    onSuccess: () => {
      toast.success('매칭 신청을 취소했습니다');
      qc.invalidateQueries({ queryKey: ['mentoring', 'matches', 'my'] });
      qc.invalidateQueries({ queryKey: ['mentoring', 'stats'] });
    },
    onError: () => toast.error('취소에 실패했습니다'),
  });

  const approveMut = useMutation({
    mutationFn: (matchId: string) => mentoringApi.approveMatch(matchId),
    onSuccess: () => {
      toast.success('멘토링 요청을 승인했습니다');
      qc.invalidateQueries({ queryKey: ['mentoring', 'matches', 'my'] });
      qc.invalidateQueries({ queryKey: ['mentoring', 'stats'] });
    },
    onError: () => toast.error('승인에 실패했습니다'),
  });

  const rejectMut = useMutation({
    mutationFn: (matchId: string) => mentoringApi.rejectMatch(matchId),
    onSuccess: () => {
      toast.success('멘토링 요청을 거절했습니다');
      qc.invalidateQueries({ queryKey: ['mentoring', 'matches', 'my'] });
      qc.invalidateQueries({ queryKey: ['mentoring', 'stats'] });
    },
    onError: () => toast.error('거절에 실패했습니다'),
  });

  const allMatches = myMatchesQ.data ?? [];
  const pendingMentorIds = new Set(allMatches.filter((m) => m.status === 'PENDING').map((m) => m.mentorId));
  // 내가 신청한 매칭(멘티) / 나에게 온 신청(멘토) 분리
  const sentMatches = allMatches.filter((m) => m.menteeId === myMemberId);
  const receivedMatches = allMatches.filter((m) => m.mentorId === myMemberId);
  const filterMatches = (list: typeof allMatches) =>
    statusFilter === 'ALL' ? list : list.filter((m) => m.status === statusFilter);

  const stats = statsQ.data;

  return (
    <>
      <PageHead
        title="멘토링"
        description="AI 추천 멘토에게 멘토링을 신청하고 매칭 현황을 확인합니다."
        right={
          <button type="button" onClick={() => setShowModal(true)} className={btnPrimaryCls}>
            <MessageSquarePlus size={13} />멘토링 신청
          </button>
        }
      />

      {/* 통계 */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: '진행 중',    value: stats.active,            color: 'text-brand-deep' },
            { label: '승인 대기',  value: stats.pending,           color: 'text-amber-600' },
            { label: '가능한 멘토', value: stats.availableMentors,  color: 'text-fg' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-[#e5e7e0] px-4 py-3.5 text-center">
              <div className="text-[11px] text-fg-muted mb-1">{label}</div>
              <div className={clsx('text-[22px] font-extrabold', color)}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 필터 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#e5e7e0] rounded-xl text-[12.5px] font-semibold hover:border-[#8FA0AE] transition-colors"
          >
            {statusFilter === 'ALL' ? '전체 상태' : STATUS_META[statusFilter as keyof typeof STATUS_META]?.label ?? statusFilter}
            <ChevronDown size={13} className={clsx('text-fg-muted transition-transform', filterOpen && 'rotate-180')} />
          </button>
          {filterOpen && (
            <div className="absolute z-20 top-full mt-1 bg-white border border-[#e5e7e0] rounded-xl shadow-lg overflow-hidden min-w-[120px]">
              {(['ALL', 'PENDING', 'ACTIVE', 'COMPLETED', 'REJECTED'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setStatusFilter(s); setFilterOpen(false); }}
                  className={clsx(
                    'w-full text-left px-4 py-2.5 text-[12.5px] hover:bg-[#f5f6f4] transition-colors',
                    s === statusFilter && 'bg-brand-soft font-semibold text-brand-deep',
                  )}
                >
                  {s === 'ALL' ? '전체' : STATUS_META[s].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 내가 신청한 멘토링 */}
      {(myMatchesQ.isLoading || filterMatches(sentMatches).length > 0) && (
        <div className="mb-4">
          <div className="text-[11.5px] font-extrabold tracking-widest text-fg-muted uppercase mb-2 px-1">내가 신청한 멘토링 <span className="font-semibold normal-case tracking-normal">{filterMatches(sentMatches).length}건</span></div>
          <div className="bg-white border border-[#e5e7e0] rounded-2xl overflow-hidden">
            {myMatchesQ.isLoading ? (
              <div className="py-10 text-center text-sm text-fg-muted">불러오는 중…</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e7e0] bg-[#f9faf8] text-fg-muted text-[12px]">
                    {['멘토', '작목 · 지역', '도움 영역', '신청일', '상태', '관리'].map((h) => (
                      <th key={h} className="text-center px-5 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filterMatches(sentMatches).map((m) => {
                    const meta = STATUS_META[m.status as keyof typeof STATUS_META] ?? STATUS_META.PENDING;
                    const Icon = meta.icon;
                    const info = mentorInfoMap.get(m.mentorId);
                    return (
                      <tr key={m.matchId} className="border-b border-[#e5e7e0] last:border-0 hover:bg-[#f9faf8] transition-colors">
                        <td className="px-5 py-3.5">
                          <button onClick={() => setDetailMentor(m.mentorId)} className="font-semibold text-[13px] hover:underline text-left flex items-center gap-1">
                            {m.mentorName} <Info size={11} className="text-fg-muted flex-none" />
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-[12.5px] text-fg-muted text-center">
                          {info?.mainCrop || info?.region ? [info.mainCrop, info.region].filter(Boolean).join(' · ') : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {m.helpAreas.length > 0
                              ? m.helpAreas.map((a) => <span key={a} className="text-[11px] px-2 py-0.5 rounded-full bg-brand-soft text-brand-deep font-semibold">{a}</span>)
                              : <span className="text-[12px] text-fg-muted">—</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[12.5px] text-fg-muted text-center">{fmtDate(m.createdAt)}</td>
                        <td className="px-5 py-3.5">
                          <span className={clsx('flex items-center gap-1 w-fit mx-auto px-2.5 py-1 rounded-full text-[11px] font-bold', meta.color)}>
                            <Icon size={11} />{meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {m.status === 'PENDING' && (
                            <button onClick={() => cancelMatch.mutate(m.matchId)} disabled={cancelMatch.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-bold disabled:opacity-50"
                              style={{ background: '#fdecec', color: '#d23f3f' }}>
                              <X size={11} />취소
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 나에게 온 멘토링 신청 */}
      {filterMatches(receivedMatches).length > 0 && (
        <div className="mb-4">
          <div className="text-[11.5px] font-extrabold tracking-widest text-fg-muted uppercase mb-2 px-1">나에게 온 신청 <span className="font-semibold normal-case tracking-normal">{filterMatches(receivedMatches).length}건</span></div>
          <div className="bg-white border border-[#e5e7e0] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e7e0] bg-[#f9faf8] text-fg-muted text-[12px]">
                  {['신청자', '작목 · 지역', '도움 영역', '신청일', '상태', '관리'].map((h) => (
                    <th key={h} className="text-center px-5 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filterMatches(receivedMatches).map((m) => {
                  const meta = STATUS_META[m.status as keyof typeof STATUS_META] ?? STATUS_META.PENDING;
                  const Icon = meta.icon;
                  const info = mentorInfoMap.get(m.menteeId);
                  return (
                    <tr key={m.matchId} className="border-b border-[#e5e7e0] last:border-0 hover:bg-[#f9faf8] transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-[13px]">{m.menteeName}</span>
                      </td>
                      <td className="px-5 py-3.5 text-[12.5px] text-fg-muted text-center">
                        {info?.mainCrop || info?.region ? [info.mainCrop, info.region].filter(Boolean).join(' · ') : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {m.helpAreas.length > 0
                            ? m.helpAreas.map((a) => <span key={a} className="text-[11px] px-2 py-0.5 rounded-full bg-brand-soft text-brand-deep font-semibold">{a}</span>)
                            : <span className="text-[12px] text-fg-muted">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[12.5px] text-fg-muted text-center">{fmtDate(m.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <span className={clsx('flex items-center gap-1 w-fit mx-auto px-2.5 py-1 rounded-full text-[11px] font-bold', meta.color)}>
                          <Icon size={11} />{meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {m.status === 'PENDING' && (
                          <div className="inline-flex gap-1.5">
                            <button onClick={() => approveMut.mutate(m.matchId)} disabled={approveMut.isPending || rejectMut.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-bold disabled:opacity-50"
                              style={{ background: '#e8f5e9', color: '#2e7d32' }}>
                              <CheckCircle2 size={11} />승인
                            </button>
                            <button onClick={() => rejectMut.mutate(m.matchId)} disabled={approveMut.isPending || rejectMut.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-bold disabled:opacity-50"
                              style={{ background: '#fdecec', color: '#d23f3f' }}>
                              <X size={11} />거절
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 둘 다 없을 때 */}
      {!myMatchesQ.isLoading && filterMatches(sentMatches).length === 0 && filterMatches(receivedMatches).length === 0 && (
        <div className="bg-white border border-[#e5e7e0] rounded-2xl py-20 flex flex-col items-center gap-3">
          <Users size={36} className="text-[#e5e7e0]" />
          <p className="text-[13px] text-fg-muted">신청한 멘토링이 없습니다</p>
          <button type="button" onClick={() => setShowModal(true)} className={btnPrimaryCls}>
            <MessageSquarePlus size={13} />멘토링 신청하기
          </button>
        </div>
      )}

      {showModal && user && (
        <RequestModal
          onClose={() => setShowModal(false)}
          menteeId={myMemberId}
          pendingMentorIds={pendingMentorIds}
        />
      )}
      {detailMentor && user && (
        <MentorDetailPopup
          mentorId={detailMentor}
          menteeId={user.userId}
          onClose={() => setDetailMentor(null)}
        />
      )}
    </>
  );
}
