'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { ArrowLeft, FileText, Calendar, ChevronDown } from 'lucide-react';
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell,
  PieChart, Pie, Label,
} from 'recharts';
import { PageHead, btnCls, btnPrimaryCls, cardCls } from '@/components/shared/PageHead';
import { RoleGuard } from '@/components/shared/RoleGuard';
import { membersApi } from '@/lib/api/members';
import type { MemberAnalysis } from '@/types/member';

const CATEGORY_LABEL: Record<string, string> = {
  PRODUCTION: '생산', SHIPPING: '출하', REVENUE: '수익',
  QUALITY: '품질', COST: '비용', CROP_CHANGE: '경축', CONNECT: '연결',
};
const GROUP_LABEL: Record<string, string> = { TOP: '상위', MID: '중위', LOW: '개선 필요' };
const GROUP_BADGE: Record<string, string> = {
  TOP: 'bg-group-top-bg text-group-top',
  MID: 'bg-group-mid-bg text-group-mid',
  LOW: 'bg-group-low-bg text-group-low',
};
// 역할 테마에 따라 자동 — 운영 책임자=초록 / 조합원=파랑
const xaiColor = (t: string) => (t === 'pos' ? 'var(--color-brand)' : t === 'neg' ? '#d23f3f' : '#8c918d');

// XAI 워터폴: baseline + Σ기여도 = totalScore
function buildXai(a: MemberAnalysis) {
  const rows: Array<{ label: string; base: number; value: number; type: string }> = [
    { label: '기준', base: 0, value: a.baseline, type: 'base' },
  ];
  let running = a.baseline;
  for (const f of a.xaiFactors) {
    const c = f.contribution;
    if (c >= 0) rows.push({ label: f.factor, base: running, value: c, type: 'pos' });
    else rows.push({ label: f.factor, base: running + c, value: -c, type: 'neg' });
    running += c;
  }
  rows.push({ label: '총점', base: 0, value: a.totalScore, type: 'base' });
  return rows;
}

export default function MemberDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  const router = useRouter();
  const analysisQ = useQuery({
    queryKey: ['analysis', 'member', uid],
    queryFn: () => membersApi.getAnalysis(uid, '2026-05').then((r) => r.data.data),
    enabled: !!uid,
  });

  return (
    <RoleGuard allow={['UNION_ADMIN']}>
      <button type="button" onClick={() => router.push('/members')} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-fg-muted hover:text-fg mb-3">
        <ArrowLeft size={15} /> 조합원 목록
      </button>

      {analysisQ.isLoading ? (
        <div className="text-center py-20 text-fg-muted text-sm">불러오는 중…</div>
      ) : !analysisQ.data ? (
        <div className="text-center py-20 text-fg-muted text-sm">분석 데이터를 불러오지 못했습니다 ({uid})</div>
      ) : (
        <DetailBody uid={uid} a={analysisQ.data} />
      )}
    </RoleGuard>
  );
}

function DetailBody({ uid, a }: { uid: string; a: MemberAnalysis }) {
  const comp = [
    { label: '생산성', score: a.components.production.value },
    { label: '출하', score: a.components.shipping.value },
    { label: '수익성', score: a.components.revenue.value },
    { label: '품질', score: a.components.quality.value },
    { label: '비용 효율', score: a.components.costEfficiency.value },
  ];
  const xai = buildXai(a);
  const trend = a.scoreHistory.map((h) => ({ m: h.period.slice(2), score: h.score }));
  const suit = a.cropSuitability.map((s) => ({ crop: s.crop, fit: s.fitScore, current: s.current }));
  const actions = a.improvementTasks.map((t) => ({
    tag: CATEGORY_LABEL[t.category] ?? t.category,
    title: t.title,
    desc: t.description,
    effect: `▲ +${t.expectedImpact.scoreDelta}점 예상`,
  }));
  const up = a.scoreDelta >= 0;

  return (
    <>
      <PageHead
        title={`${a.name} 상세 분석`}
        description={`${uid} · ${a.region} · ${a.crop} ${a.years}년차`}
        right={
          <div className="flex items-center gap-2">
            <button type="button" className={btnPrimaryCls + ' gap-1.5'} onClick={() => toast.success('액션플랜 리포트 생성 요청을 보냈습니다')}>
              <FileText size={14} /> 액션플랜 리포트 생성
            </button>
            <button className={btnCls + ' gap-1.5'}>
              <Calendar size={14} /><span>{a.period}</span><ChevronDown size={12} />
            </button>
          </div>
        }
      />

      {/* 상단 — 프로필 + KPI */}
      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] max-[1180px]:grid-cols-2 max-[720px]:grid-cols-1 gap-3 mb-3.5">
        <div className={`${cardCls} flex items-center gap-3.5 p-4.5!`}>
          <div className="w-13 h-13 rounded-full bg-brand-soft text-brand-deep grid place-items-center font-extrabold text-lg flex-none">{a.name.slice(0, 2)}</div>
          <div>
            <div className="font-extrabold text-base flex items-center gap-1.5">
              {a.name}
              <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold', GROUP_BADGE[a.group] ?? GROUP_BADGE.MID)}>{GROUP_LABEL[a.group] ?? a.group}</span>
            </div>
            <div className="text-xs text-fg-muted mt-0.5">주요 경축 {a.crop} · {a.region}</div>
          </div>
        </div>
        {[
          { k: '총 성과율', v: `${a.totalScore.toFixed(1)}`, unit: '점', d: `${up ? '▲' : '▼'} ${Math.abs(a.scoreDelta)} vs 전월`, good: up },
          { k: '조합 내 순위', v: `${a.rank}`, unit: `/ ${a.rankTotal}`, d: `${GROUP_LABEL[a.group] ?? a.group} 그룹`, good: true },
          { k: '출하 적중률', v: `${a.shippingHitRate}`, unit: '%',
            d: typeof a.shippingHitRateDelta === 'number'
              ? `${a.shippingHitRateDelta >= 0 ? '▲' : '▼'} ${Math.abs(a.shippingHitRateDelta)} vs 전월`
              : (typeof a.components.shipping?.percentile === 'number' ? `조합 내 상위 ${Math.max(1, 100 - a.components.shipping.percentile)}%` : ''),
            good: a.shippingHitRateDelta == null || a.shippingHitRateDelta >= 0 },
        ].map(({ k, v, unit, d, good }) => (
          <div key={k} className={`${cardCls} flex flex-col gap-1.5`}>
            <span className="text-[11.5px] text-fg-muted font-bold tracking-wider uppercase">{k}</span>
            <span className="text-2xl font-extrabold tracking-tight">
              {v}<small className="text-sm text-fg-muted font-semibold"> {unit}</small>
            </span>
            {d && <span className={clsx('text-xs font-bold', good ? 'text-group-top' : 'text-group-low')}>{d}</span>}
          </div>
        ))}
      </div>

      {/* 중단 — 구성요소 / XAI / 개선과제 */}
      <div className="grid grid-cols-[1fr_1.5fr_1.1fr] max-[1180px]:grid-cols-1 gap-3 mb-3">
        <section className={cardCls}>
          <div className="mb-3.5"><div className="text-[14.5px] font-bold">구성요소 점수</div></div>
          <div className="grid gap-3.5">
            {comp.map((b) => (
              <div key={b.label}>
                <div className="flex items-baseline justify-between text-[13px] mb-1.5">
                  <span className="font-semibold">{b.label}</span>
                  <span className="font-extrabold text-brand-deep">{b.score}</span>
                </div>
                <div className="relative h-2 bg-bg-soft rounded-full overflow-hidden">
                  <div className="absolute inset-0 right-auto rounded-full" style={{ width: `${b.score}%`, background: 'linear-gradient(90deg, var(--color-brand), var(--color-brand-deep))' }} />
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
              <BarChart data={xai} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#ececec" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8c918d', fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
                <YAxis domain={[0, 100]} tick={{ fill: '#8c918d', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #ececec', fontSize: 12 }} />
                <Bar dataKey="base" stackId="a" fill="transparent" />
                <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
                  {xai.map((d, i) => <Cell key={i} fill={xaiColor(d.type)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={cardCls}>
          <div className="mb-3.5"><div className="text-[14.5px] font-bold">우선 개선 과제</div></div>
          <div className="grid gap-2">
            {actions.length === 0 && <div className="text-xs text-fg-muted py-4 text-center">개선 과제가 없습니다.</div>}
            {actions.map((act) => (
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

      {/* 하단 — 12개월 추이 / 경축 적합도 */}
      <div className="grid grid-cols-[1.6fr_1fr] max-[1180px]:grid-cols-1 gap-3 mb-3.5">
        <section className={cardCls}>
          <div className="mb-3.5"><div className="text-[14.5px] font-bold">성과 이력 (최근 {trend.length}개월)</div></div>
          <div className="h-55">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="#ececec" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="m" tick={{ fill: '#8c918d', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={['dataMin - 4', 'dataMax + 4']} tick={{ fill: '#8c918d', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #ececec', fontSize: 12 }} />
                <Line type="monotone" dataKey="score" stroke="var(--color-brand)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--color-brand-deep)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={cardCls}>
          <div className="mb-2"><div className="text-[14.5px] font-bold">경축 적합도</div></div>
          {(() => {
            const BRAND = '#41AA4D';
            const filtered = suit.filter((s) => s.fit > 0);
            if (filtered.length === 0) return (
              <div className="flex items-center justify-center h-44 text-[13px] text-fg-muted">적합도 데이터가 없습니다</div>
            );
            const cols = filtered.length === 1 ? 1 : 2;
            return (
              <>
                <div className={`grid gap-3 ${cols === 1 ? '' : 'grid-cols-2'}`}>
                  {filtered.map((s, i) => {
                    const color = BRAND;
                    const sz = cols === 1 ? { h: 200, ir: 62, or: 98 } : { h: 130, ir: 38, or: 58 };
                    return (
                      <div key={s.crop} className="flex flex-col items-center">
                        <div style={{ height: sz.h, width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[{ value: s.fit }, { value: 100 - s.fit }]}
                                cx="50%" cy="50%"
                                innerRadius={sz.ir} outerRadius={sz.or}
                                startAngle={90} endAngle={-270}
                                dataKey="value"
                                strokeWidth={0}
                              >
                                <Cell fill={color} />
                                <Cell fill="#e5e7eb" />
                                <Label content={({ viewBox }: any) => {
                                  const { cx, cy } = viewBox;
                                  return (
                                    <text textAnchor="middle" dominantBaseline="central">
                                      <tspan x={cx} y={cy - (cols === 1 ? 8 : 5)} fontSize={cols === 1 ? 26 : 16} fontWeight={800} fill={color}>{s.fit}</tspan>
                                      <tspan x={cx} y={cy + (cols === 1 ? 16 : 11)} fontSize={cols === 1 ? 12 : 10} fontWeight={600} fill="#8c918d">점</tspan>
                                    </text>
                                  );
                                }} />
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <span className="text-[12px] font-bold mt-1" style={{ color }}>
                          {s.crop}{s.current && <span style={{ color: BRAND }}> ●</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11.5px] text-fg-muted mt-3 leading-snug text-center">토양·기상 공공데이터 기반 적합도 점수 · <span style={{ color: BRAND }}>●</span> 현재 작목</p>
              </>
            );
          })()}
        </section>
      </div>


    </>
  );
}
