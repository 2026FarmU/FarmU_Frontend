'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, MapPin } from 'lucide-react';
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { PageHead, btnCls, btnPrimaryCls, cardCls } from '@/components/shared/PageHead';
import { RoleGuard } from '@/components/shared/RoleGuard';
import { mentoringApi } from '@/lib/api/mentoring';
import { useMe } from '@/lib/hooks/useMe';
import type { MatchDetail } from '@/types/mentoring';

const CATEGORY_LABEL: Record<string, string> = {
  PRODUCTION: '생산', SHIPPING: '출하', REVENUE: '수익',
  QUALITY: '품질', COST: '비용', CROP_CHANGE: '경축', CONNECT: '연결',
};

const FACTOR_LABEL: Record<string, string> = {
  PERFORMANCE: '성과', CROP_MATCH: '경축 일치', DISTANCE: '거리', EXPERIENCE: '경력',
};

const matchColor = (v: number) =>
  v >= 90 ? 'var(--color-brand)' : v >= 75 ? 'var(--color-brand-deep)' : v >= 60 ? '#d97706' : '#d23f3f';

export default function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: me } = useMe();
  const menteeId = me?.memberId ?? '';

  const detailQ = useQuery({
    queryKey: ['mentoring', 'detail', id, menteeId],
    queryFn: () => mentoringApi.getSuggestionDetail(id, menteeId).then((r) => r.data.data),
    enabled: !!menteeId && !!id,
  });

  return (
    <RoleGuard allow={['MEMBER']}>
      <button type="button" onClick={() => router.push('/mentoring')} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-fg-muted hover:text-fg mb-3">
        <ArrowLeft size={15} /> 조합원 연결
      </button>

      {detailQ.isLoading ? (
        <div className="text-center py-20 text-fg-muted text-sm">불러오는 중…</div>
      ) : !detailQ.data ? (
        <div className="text-center py-20 text-fg-muted text-sm">존재하지 않는 매칭입니다 ({id})</div>
      ) : (
        <MatchBody m={detailQ.data} menteeId={menteeId} />
      )}
    </RoleGuard>
  );
}

function MatchBody({ m, menteeId }: { m: MatchDetail; menteeId: string }) {
  const init = m.name.slice(0, 1);
  const compare = m.comparison.map((c) => ({ k: CATEGORY_LABEL[c.category] ?? c.category, 멘티: c.menteeScore, 멘토: c.mentorScore }));

  const requestMatch = useMutation({
    mutationFn: () => mentoringApi.requestMatch({ mentorId: m.mentorId, menteeId, goal: '성과 개선' }),
    onSuccess: () => toast.success('매칭을 요청했습니다'),
    onError: () => toast.error('매칭 요청에 실패했습니다'),
  });

  return (
    <>
      <PageHead
        title={`${m.name} 매칭 상세`}
        description={`${m.crop} ${m.years}년차 · 경기 ${m.region} · ${m.distanceKm}km와의 매칭`}
      />

      {/* 상단 — 멘토 프로필 + 매칭 점수 + CTA */}
      <div className={`${cardCls} relative overflow-hidden mb-3.5`}>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand to-brand-deep" />
        <div className="flex items-center gap-4 mt-1 flex-wrap">
          <div className="w-16 h-16 rounded-full bg-brand-soft text-brand-deep grid place-items-center font-extrabold text-2xl flex-none">{init}</div>
          <div className="flex-1 min-w-50">
            <div className="font-extrabold text-lg">{m.name}</div>
            <div className="text-[12.5px] text-fg-muted mt-0.5 flex items-center gap-1.5">
              <MapPin size={13} /> 경기 {m.region} · {m.distanceKm}km · 성과율 {m.mentorScore}점
            </div>
            <div className="flex gap-1 flex-wrap mt-2">
              {m.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 bg-bg-soft rounded-full text-[11px] text-fg-soft font-semibold">{t}</span>
              ))}
            </div>
          </div>
          <div className="text-center px-4">
            <div className="text-[40px] font-extrabold text-brand-deep leading-none tracking-tight">{m.matchScore}</div>
            <div className="text-[10.5px] text-fg-muted font-bold tracking-wider uppercase mt-1">매칭 점수</div>
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" disabled={requestMatch.isPending} className={`${btnPrimaryCls} justify-center disabled:opacity-50`} onClick={() => requestMatch.mutate()}>
              <UserPlus size={14} /> 매칭 요청
            </button>
          </div>
        </div>
      </div>

      {/* 매칭 근거 + 성과 비교 */}
      <div className="grid grid-cols-[1fr_1.2fr] max-[1180px]:grid-cols-1 gap-3 mb-3.5">
        <section className={cardCls}>
          <div className="mb-3.5"><div className="text-[14.5px] font-bold">매칭 근거</div><div className="text-[12.5px] text-fg-muted mt-0.5">요인별 적합도 (가중 평균 → 매칭 점수)</div></div>
          <div className="grid gap-3">
            {m.matchFactors.map(({ factor, score }) => {
              const v = Math.round(score);
              return (
                <div key={factor}>
                  <div className="flex items-baseline justify-between text-[13px] mb-1.5">
                    <span className="font-semibold">{FACTOR_LABEL[factor] ?? factor}</span>
                    <span className="font-extrabold" style={{ color: matchColor(v) }}>{v}</span>
                  </div>
                  <div className="relative h-2 bg-bg-soft rounded-full overflow-hidden">
                    <div className="absolute inset-0 right-auto rounded-full" style={{ width: `${v}%`, background: matchColor(v) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={cardCls}>
          <div className="mb-3.5"><div className="text-[14.5px] font-bold">성과 비교</div><div className="text-[12.5px] text-fg-muted mt-0.5">멘티 본인 vs 멘토</div></div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compare} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barGap={4}>
                <CartesianGrid stroke="#ececec" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="k" tick={{ fill: '#8c918d', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#8c918d', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #ececec', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="멘티" fill="#c5cdc6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="멘토" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* 추천 사유 + 멘토가 도울 수 있는 영역 */}
      <section className={`${cardCls} mb-3.5`}>
        <div className="text-[14.5px] font-bold mb-2">왜 이 멘토인가요?</div>
        <p className="text-[13.5px] text-fg-soft leading-relaxed">{m.reason}</p>
      </section>

      <section className={`${cardCls} mb-3.5`}>
        <div className="mb-3.5"><div className="text-[14.5px] font-bold">멘토가 도울 수 있는 영역</div></div>
        <div className="grid grid-cols-3 max-[720px]:grid-cols-1 gap-2.5">
          {m.helpAreas.map((h) => (
            <div key={h.title} className="bg-bg-soft border border-border-soft rounded-[10px] p-3.5 grid gap-1.5">
              <span className="text-[10px] font-extrabold tracking-wider text-brand-deep uppercase">{CATEGORY_LABEL[h.category] ?? h.category}</span>
              <div className="text-[13.5px] font-bold">{h.title}</div>
              <div className="text-xs text-fg-soft leading-snug">{h.description}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 하단 CTA */}
      <div className="flex gap-2">
<button type="button" disabled={requestMatch.isPending} className={`${btnPrimaryCls} flex-1 justify-center disabled:opacity-50`} onClick={() => requestMatch.mutate()}>
          <UserPlus size={14} /> 이 멘토와 매칭 요청
        </button>
      </div>
    </>
  );
}
