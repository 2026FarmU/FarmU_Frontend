'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, Target, DollarSign, Clock, Calendar, ChevronDown } from 'lucide-react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { RoleGuard } from '@/components/shared/RoleGuard';
import { PageHead, cardCls, btnCls, chipCls, chipOnCls } from '@/components/shared/PageHead';
import { useAuthStore } from '@/lib/store/authStore';
import { dashboardApi } from '@/lib/api/dashboard';

function reshapeTrends(t: { series?: Array<{ group: string; points: Array<{ period: string; value: number }> }> } | undefined) {
  if (!t?.series?.length) return [];
  const byGroup: Record<string, Record<string, number>> = {};
  const periods = new Set<string>();
  for (const s of t.series) {
    byGroup[s.group] = {};
    for (const p of s.points) {
      byGroup[s.group][p.period] = p.value;
      periods.add(p.period);
    }
  }
  return [...periods].sort().map((period) => ({
    m: period.slice(2),
    avg: byGroup.avg?.[period],
    top: byGroup.top?.[period],
    low: byGroup.low?.[period],
  }));
}

const LEVEL_LABEL: Record<string, string> = { high: '위험', medium: '주의', low: '알림' };
const LEVEL_PILL: Record<string, string> = {
  high: 'bg-group-low-bg text-group-low',
  medium: 'bg-warn-bg text-warn',
  low: 'bg-info-bg text-info',
};
const won = (v: number) => (v / 1_000_000).toFixed(1);
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
};

export default function DashboardPage() {
  const unionId = useAuthStore((s) => s.user?.unionId) ?? '';
  const [period, setPeriod] = useState('2026-05');
  const [trendView, setTrendView] = useState<'all' | 'top' | 'mid' | 'low'>('all');
  const [alertLevel, setAlertLevel] = useState('all');
  const qc = useQueryClient();

  const summaryQ = useQuery({
    queryKey: ['dashboard', 'summary', unionId, period],
    queryFn: () => dashboardApi.getSummary({ unionId, period }).then((r) => r.data.data),
    enabled: !!unionId,
  });

  const alertsQ = useQuery({
    queryKey: ['dashboard', 'alerts', unionId],
    queryFn: () => dashboardApi.getAlerts({ unionId }).then((r) => r.data.data),
    enabled: !!unionId,
  });

  const trendsQ = useQuery({
    queryKey: ['dashboard', 'trends', unionId],
    queryFn: () => dashboardApi.getTrends({ unionId, from: '2025-06', to: period, metric: 'score' }).then((r) => r.data.data),
    enabled: !!unionId,
  });

  const TREND = reshapeTrends(trendsQ.data);

  const dismiss = useMutation({
    mutationFn: (id: string) => dashboardApi.dismissAlert(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', 'alerts', unionId] });
      toast.info('알림을 해제했습니다');
    },
    onError: () => toast.error('알림 해제에 실패했습니다'),
  });

  const s = summaryQ.data;

  const KPIS = [
    { k: '평균 성과율', v: s ? s.avgScore.toFixed(1) : '—', unit: '점', delta: s?.scoreDelta, dfmt: (n: number) => `${n.toFixed(1)}점`, I: TrendingUp },
    { k: '출하 적중률', v: s ? String(s.kpi.shippingHitRate) : '—', unit: '%', delta: s?.kpiDelta?.shippingHitRate, dfmt: (n: number) => `${n.toFixed(1)}%p`, I: Target },
    { k: '조합원 평균 수익', v: s ? won(s.kpi.avgRevenue) : '—', unit: 'M / 월', delta: s?.kpiDelta?.avgRevenue, dfmt: (n: number) => `${won(n)}M`, I: DollarSign },
    { k: '리포트 작성 단축률', v: s ? String(s.kpi.reportTimeReduced) : '—', unit: '%', delta: s?.kpiDelta?.reportTimeReduced, dfmt: (n: number) => `${n.toFixed(1)}%p`, I: Clock },
  ];

  const GROUP = [
    { name: '상위', value: s?.groupDistribution.top ?? 0, color: '#16a34a', desc: '80점 이상' },
    { name: '중위', value: s?.groupDistribution.mid ?? 0, color: '#2563eb', desc: '60~79점' },
    { name: '개선 필요', value: s?.groupDistribution.low ?? 0, color: '#dc2626', desc: '60점 미만' },
  ];

  const alerts = (alertsQ.data ?? []).map((a) => ({
    id: a.id,
    level: a.level.toLowerCase(),
    title: a.title,
    desc: a.message,
    target: `조합원 ${a.affectedMembers}명`,
    time: fmtTime(a.createdAt),
  }));
  const shownAlerts = alertLevel === 'all' ? alerts : alerts.filter((a) => a.level === alertLevel);

  return (
    <RoleGuard allow={['UNION_ADMIN']}>
      <PageHead
        title="대시보드"
        description="합천농업법인회사 조합 전체 운영 현황을 한눈에 확인합니다."
        right={
          <>
            <div className={`${btnCls} relative gap-1.5`}>
              <Calendar size={14} />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="appearance-none bg-transparent outline-none font-bold text-[13.5px] cursor-pointer pr-0.5"
              >
                {(s?.availablePeriods?.length ? s.availablePeriods : [period]).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none text-fg-muted -ml-0.5" />
            </div>
            <button
              type="button"
              className={btnCls}
              onClick={() => {
                summaryQ.refetch();
                alertsQ.refetch();
                toast.success('최신 데이터로 갱신했습니다');
              }}
            >
              새로고침
            </button>
          </>
        }
      />

      {summaryQ.isError && (() => {
        const notCalculated = isAxiosError(summaryQ.error) && summaryQ.error.response?.status === 404;
        return notCalculated ? (
          <div className="mb-3.5 text-[13px] text-warn bg-warn-bg rounded-lg px-4 py-3">
            {period} 기간의 조합 성과가 아직 집계되지 않았습니다. 데이터 업로드·반영 후 성과가 계산되면 표시됩니다.
          </div>
        ) : (
          <div className="mb-3.5 text-[13px] text-group-low bg-group-low-bg rounded-lg px-4 py-3">
            요약 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
          </div>
        );
      })()}

      <div className="grid grid-cols-4 max-[1180px]:grid-cols-2 max-[720px]:grid-cols-1 gap-3 mb-3.5">
        {KPIS.map(({ k, v, unit, delta, dfmt, I }) => (
          <div key={k} className={`${cardCls} flex flex-col gap-1.5 cursor-pointer hover:border-brand hover:-translate-y-px transition-all`}>
            <span className="text-[11.5px] text-fg-muted font-bold tracking-wider uppercase flex items-center gap-1.5">
              <I size={14} className="text-brand" /> {k}
            </span>
            <span className="text-[26px] font-extrabold tracking-tight">
              {v}<small className="text-sm text-fg-muted font-semibold ml-0.5">{unit}</small>
            </span>
            {typeof delta === 'number' && (
              <span className={`text-xs font-bold ${delta >= 0 ? 'text-group-top' : 'text-group-low'}`}>
                {delta >= 0 ? '▲ +' : '▼ '}{dfmt(Math.abs(delta))} vs 전월
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] max-[1180px]:grid-cols-1 gap-3 mb-3.5">
        <section className={cardCls}>
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <div className="text-[14.5px] font-bold">월별 성과율 추이</div>
              <div className="text-[12.5px] text-fg-muted">최근 6개월 · 조합 평균</div>
            </div>
            <div className="flex gap-1.5">
              {(['all', 'top', 'mid', 'low'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setTrendView(k)} className={trendView === k ? chipOnCls : chipCls}>
                  {k === 'all' ? '전체' : k === 'top' ? 'TOP' : k === 'mid' ? '중위' : '개선필요'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-70">
            {TREND.length < 2 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-fg-muted">
                <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="opacity-30">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-4 4 4 4-6" />
                </svg>
                <span className="text-[13px]">아직 추이를 그릴 데이터가 부족합니다</span>
                <span className="text-[11.5px] opacity-60">2개월 이상 데이터가 쌓이면 표시됩니다</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={TREND} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="#ececec" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="m" tick={{ fill: '#8c918d', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[50, 95]} tick={{ fill: '#8c918d', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #ececec', fontSize: 12 }} />
                  {(trendView === 'all' || trendView === 'mid') && (
                    <Line type="monotone" dataKey="avg" name="전체 평균" stroke="#41AA4D" strokeWidth={2.5} dot={{ r: 3, fill: '#339940' }} />
                  )}
                  {(trendView === 'all' || trendView === 'top') && (
                    <Line type="monotone" dataKey="top" name="상위 그룹" stroke="#16a34a" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  )}
                  {(trendView === 'all' || trendView === 'low') && (
                    <Line type="monotone" dataKey="low" name="개선 필요" stroke="#dc2626" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex justify-center gap-5 mt-1.5">
            {([['전체 평균', '#41AA4D', false], ['상위 그룹', '#16a34a', true], ['개선 필요', '#dc2626', true]] as [string, string, boolean][]).map(([label, color, dashed]) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-[11.5px] text-fg-soft">
                <span className="inline-block w-4" style={{ borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
                {label}
              </span>
            ))}
          </div>
        </section>

        <section className={cardCls}>
          <div className="mb-3.5">
            <div className="text-[14.5px] font-bold">조합원 그룹 분포</div>
            <div className="text-[12.5px] text-fg-muted">
              전체 {s?.memberCount ?? GROUP.reduce((sum, g) => sum + g.value, 0)}명
            </div>
          </div>
          <div className="grid grid-cols-[200px_1fr] max-[1180px]:grid-cols-1 gap-4 items-center">
            <div className="w-50 h-50 mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={GROUP} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {GROUP.map((g) => <Cell key={g.name} fill={g.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-2.5">
              {GROUP.map((g) => (
                <div key={g.name} className="grid grid-cols-[12px_1fr_auto] gap-2.5 items-center p-2 rounded-lg hover:bg-bg-soft cursor-pointer">
                  <span className="w-3 h-3 rounded-sm" style={{ background: g.color }} />
                  <div className="text-[13px] font-semibold">
                    {g.name}
                    <small className="block text-[11px] text-fg-muted font-medium mt-0.5">{g.desc}</small>
                  </div>
                  <div className="font-extrabold text-[15px]">
                    {g.value}<small className="text-[11px] text-fg-muted font-semibold ml-1">명</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="bg-white border border-border-soft rounded-xl pt-4.5 pb-0">
        <div className="flex justify-between items-start px-4.5 pb-3.5 border-b border-border-soft flex-wrap gap-2.5">
          <div>
            <div className="text-[14.5px] font-bold">위험 알림</div>
            <div className="text-[12.5px] text-fg-muted mt-0.5">중요도 높은 순으로 정렬</div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {([['all', '전체'], ['high', '위험'], ['medium', '주의'], ['low', '알림']] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setAlertLevel(k)} className={alertLevel === k ? chipOnCls : chipCls}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {alertsQ.isLoading && (
          <div className="px-4.5 py-8 text-center text-[13px] text-fg-muted">불러오는 중…</div>
        )}
        {!alertsQ.isLoading && shownAlerts.length === 0 && (
          <div className="px-4.5 py-8 text-center text-[13px] text-fg-muted">표시할 알림이 없습니다.</div>
        )}
        {shownAlerts.map((a) => (
          <div key={a.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3.5 items-center px-4 py-3.5 border-b border-border-soft last:border-b-0 hover:bg-bg-soft">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-extrabold ${LEVEL_PILL[a.level] ?? LEVEL_PILL.low}`}>
              {LEVEL_LABEL[a.level] ?? a.level}
            </span>
            <div>
              <div className="font-bold text-[13.5px]">{a.title}</div>
              <div className="text-xs text-fg-muted mt-0.5">{a.desc}</div>
            </div>
            <span className="text-xs text-fg-soft">{a.target}</span>
            <span className="text-[11.5px] text-fg-muted whitespace-nowrap">{a.time}</span>
            <button
              type="button"
              title="알림 해제"
              disabled={dismiss.isPending}
              onClick={() => dismiss.mutate(a.id)}
              className="w-7 h-7 rounded-md border border-border-soft bg-white text-fg-muted hover:bg-bg-soft hover:text-fg disabled:opacity-50"
            >
              ✕
            </button>
          </div>
        ))}
      </section>
    </RoleGuard>
  );
}
