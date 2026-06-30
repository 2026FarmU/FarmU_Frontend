'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { PageHead, btnCls, cardCls } from '@/components/shared/PageHead';
import { RoleGuard } from '@/components/shared/RoleGuard';
import { membersApi } from '@/lib/api/members';
import type { MemberAnalysis } from '@/types/member';
import { Calendar, ChevronDown } from 'lucide-react';
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell,
} from 'recharts';

const CATEGORY_LABEL: Record<string, string> = {
  PRODUCTION: '생산', SHIPPING: '출하', REVENUE: '수익',
  QUALITY: '품질', COST: '비용', CROP_CHANGE: '경축', CONNECT: '연결',
};
const GROUP_BADGE: Record<string, string> = {
  TOP: 'bg-group-top-bg text-group-top',
  MID: 'bg-group-mid-bg text-group-mid',
  LOW: 'bg-group-low-bg text-group-low',
};
const xaiColor = (t: string) => (t === 'pos' ? '#2563eb' : t === 'neg' ? '#d23f3f' : '#8c918d');

// XAI 워터폴: baseline + Σ기여도 = totalScore
function buildXai(a: MemberAnalysis) {
  const rows: Array<{ label: string; base: number; value: number; type: string }> = [
    { label: '기준', base: 0, value: a.baseline, type: 'base' },
  ];
  let running = a.baseline;
  for (const f of a.xaiFactors) {
    const c = f.contribution;
    if (c >= 0) {
      rows.push({ label: f.factor, base: running, value: c, type: 'pos' });
    } else {
      rows.push({ label: f.factor, base: running + c, value: -c, type: 'neg' });
    }
    running += c;
  }
  rows.push({ label: '총점', base: 0, value: a.totalScore, type: 'base' });
  return rows;
}

export default function MeAnalysisPage() {
  const analysisQ = useQuery({
    queryKey: ['analysis', 'me'],
    queryFn: () => membersApi.getAnalysis('me', '2026-05').then((r) => r.data.data),
  });
  return (
    <RoleGuard allow={['MEMBER']}>
      <AnalysisView data={analysisQ.data} loading={analysisQ.isLoading} error={analysisQ.isError} title="내 분석" />
    </RoleGuard>
  );
}

/** me/analysis · members/[uid] 공용 분석 뷰 */
export function AnalysisView({
  data: a, loading, error, title, backSlot,
}: {
  data?: MemberAnalysis; loading: boolean; error: boolean; title: string; backSlot?: React.ReactNode;
}) {
  if (loading) return <div className="text-center py-24 text-fg-muted text-sm">분석 데이터를 불러오는 중…</div>;
  if (error || !a) return <div className="text-center py-24 text-fg-muted text-sm">분석 데이터를 불러오지 못했습니다.</div>;

  const comp = a.components;
  const BARS = [
    { label: '생산성', score: comp.production.value },
    { label: '출하', score: comp.shipping.value },
    { label: '수익성', score: comp.revenue.value },
    { label: '품질', score: comp.quality.value },
    { label: '비용 효율', score: comp.costEfficiency.value },
  ];
  const XAI = buildXai(a);
  const TREND = a.scoreHistory.map((h) => ({ m: h.period.slice(2), score: h.score }));
  const ACTIONS = a.improvementTasks.map((t) => ({
    tag: CATEGORY_LABEL[t.category] ?? t.category,
    title: t.title,
    desc: t.description,
    effect: `▲ +${t.expectedImpact.scoreDelta}점 예상`,
  }));
  // 출하 적중률 보조표기: 전월 대비 델타(있으면) → 없으면 조합 내 상위 백분위
  const shipSub = typeof a.shippingHitRateDelta === 'number'
    ? `${a.shippingHitRateDelta >= 0 ? '▲' : '▼'} ${Math.abs(a.shippingHitRateDelta)} vs 전월`
    : (typeof a.components.shipping?.percentile === 'number' ? `조합 내 상위 ${Math.max(1, 100 - a.components.shipping.percentile)}%` : '');
  const KPIS = [
    { k: '총 성과율', v: a.totalScore.toFixed(1), unit: '점', d: `${a.scoreDelta >= 0 ? '▲' : '▼'} ${Math.abs(a.scoreDelta)} vs 전월` },
    { k: '출하 적중률', v: String(a.shippingHitRate), unit: '%', d: shipSub },
    { k: '조합 내 순위', v: `${a.rank}`, unit: `/${a.rankTotal}`, d: '' },
  ];

  return (
    <>
      {backSlot}
      <PageHead
        title={title}
        description="농업 운영 성과를 한눈에 살펴보고, 무엇을 어떻게 개선할지 찾아봅니다."
        right={
          <button className={btnCls}>
            <Calendar size={14} /><span>{a.period}</span><ChevronDown size={12} />
          </button>
        }
      />

      {/* 상단 — 프로필 + KPI 3 */}
      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] max-[1180px]:grid-cols-2 max-[720px]:grid-cols-1 gap-3 mb-3.5">
        <div className={`${cardCls} flex items-center gap-3.5 p-4.5!`}>
          <div className="w-13 h-13 rounded-full bg-brand-soft text-brand-deep grid place-items-center font-extrabold text-lg flex-none">{a.name.slice(0, 2)}</div>
          <div>
            <div className="font-extrabold text-base flex items-center gap-1.5">
              {a.name} <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold', GROUP_BADGE[a.group] ?? GROUP_BADGE.MID)}>{a.group}</span>
            </div>
            <div className="text-xs text-fg-muted mt-0.5">주요 경축 {a.crop} · {a.region}</div>
          </div>
        </div>
        {KPIS.map(({ k, v, unit, d }) => (
          <div key={k} className={`${cardCls} flex flex-col gap-1.5`}>
            <span className="text-[11.5px] text-fg-muted font-bold tracking-wider uppercase">{k}</span>
            <span className="text-2xl font-extrabold tracking-tight">
              {v}<small className="text-sm text-fg-muted font-semibold">{unit}</small>
            </span>
            {d && <span className="text-xs font-bold text-group-top">{d}</span>}
          </div>
        ))}
      </div>

      {/* 중단 — 구성요소 / XAI / 개선과제 */}
      <div className="grid grid-cols-[1fr_1.5fr_1.1fr] max-[1180px]:grid-cols-1 gap-3 mb-3">
        <section className={cardCls}>
          <div className="mb-3.5"><div className="text-[14.5px] font-bold">구성요소 점수</div></div>
          <div className="grid gap-3.5">
            {BARS.map((b) => (
              <div key={b.label}>
                <div className="flex items-baseline justify-between text-[13px] mb-1.5">
                  <span className="font-semibold">{b.label}</span>
                  <span className="font-extrabold text-brand-deep">{b.score}</span>
                </div>
                <div className="relative h-2 bg-bg-soft rounded-full overflow-hidden">
                  <div
                    className="absolute inset-0 right-auto rounded-full"
                    style={{ width: `${b.score}%`, background: 'linear-gradient(90deg, #2563eb, #1d4ed8)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={cardCls}>
          <div className="flex items-center justify-between mb-3.5">
            <div className="text-[14.5px] font-bold">XAI 원인 분석</div>
            <div className="text-[12.5px] text-fg-muted">총점 기여도</div>
          </div>
          <div className="h-55">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={XAI} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#ececec" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8c918d', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#8c918d', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #ececec', fontSize: 12 }} />
                <Bar dataKey="base" stackId="a" fill="transparent" />
                <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
                  {XAI.map((d, i) => <Cell key={i} fill={xaiColor(d.type)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={cardCls}>
          <div className="mb-3.5"><div className="text-[14.5px] font-bold">우선 개선 과제</div></div>
          <div className="grid gap-2">
            {ACTIONS.length === 0 && <div className="text-xs text-fg-muted py-4 text-center">개선 과제가 없습니다.</div>}
            {ACTIONS.map((act) => (
              <div key={act.title} className="bg-bg-soft border border-border-soft rounded-[10px] p-3 grid gap-1 cursor-pointer hover:border-brand">
                <span className="text-[10px] font-extrabold tracking-wider text-brand-deep uppercase">{act.tag}</span>
                <div className="text-[13.5px] font-bold">{act.title}</div>
                <div className="text-xs text-fg-soft leading-snug">{act.desc}</div>
                <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-group-top">{act.effect}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 하단 — 12개월 추이 */}
      <section className={cardCls}>
        <div className="mb-3.5"><div className="text-[14.5px] font-bold">성과 이력 (최근 {TREND.length}개월)</div></div>
        <div className="h-55">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={TREND} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="#ececec" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="m" tick={{ fill: '#8c918d', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fill: '#8c918d', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #ececec', fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3, fill: '#1d4ed8' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
