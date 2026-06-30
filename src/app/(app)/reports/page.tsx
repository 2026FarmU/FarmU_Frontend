'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { PageHead, cardCls, btnCls, btnPrimaryCls, btnSmCls, chipCls, chipOnCls } from '@/components/shared/PageHead';
import { useAuthStore } from '@/lib/store/authStore';
import { useMe } from '@/lib/hooks/useMe';
import { reportsApi } from '@/lib/api/reports';
import { aiApi } from '@/lib/api/ai';
import type { ReportType, ReportFormat } from '@/types/report';
import { FileText, Clock, Check, X, Download, RotateCcw, Sparkles, Printer, ChevronDown, Trash2 } from 'lucide-react';

// 백엔드 리포트 삭제 API가 없어(DELETE 405), 삭제는 클라이언트에서 숨김 처리(localStorage)로 동작
const DISMISS_KEY = 'farmu-dismissed-reports';

const REPORT_STATE: Record<string, 'proc' | 'done' | 'fail'> = {
  PROCESSING: 'proc', READY: 'done', FAILED: 'fail',
};
const REPORT_TYPE_LABEL: Record<string, string> = {
  MONTHLY: '조합 월간 리포트', UNION: '조합 리포트', MEMBER: '액션플랜',
};
// UI 유형 키 → 백엔드 ReportType (백엔드 실측: UNION | MONTHLY | MEMBER)
//  action/mine(액션플랜)→MEMBER · union(조합 월간)→MONTHLY · ship(출하 실적)→UNION
const toReportType = (key: string): ReportType =>
  key === 'action' || key === 'mine' ? 'MEMBER' : key === 'ship' ? 'UNION' : 'MONTHLY';
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
};

const ADMIN_TYPES = [
  { key: 'union', tag: '조합', nm: '조합 월간 리포트', ds: '조합 전체 운영 요약을 한 부에' },
  { key: 'action', tag: '조합원', nm: '조합원 액션플랜', ds: '조합원 개별 맞춤 실행 안내' },
  { key: 'ship', tag: '출하', nm: '출하 실적 리포트', ds: '월별 권고 vs 실적 비교' },
];
const MEMBER_TYPES = [
  { key: 'mine', tag: '본인', nm: '내 액션플랜', ds: '내 성과·필지 기반 개별 실행 안내' },
  { key: 'union', tag: '조합', nm: '조합 월간 리포트', ds: '조합 전체 요약 (열람 전용)' },
];

const SECTIONS_ADMIN = [
  ['요약', 'KPI·핵심 지표', true],
  ['조합원 순위', '그룹별 정렬', true],
  ['위험 알림', '중요도 표기', true],
  ['우선 실행 과제', '조합원별 액션', false],
  ['경축 적합도 요약', '필지 단위', false],
  ['출하 적중률', '월별 추이', false],
] as Array<[string, string, boolean]>;

const SECTIONS_MEMBER = [
  ['내 성과 요약', '총점·구성요소', true],
  ['우선 개선 과제', '예상 효과 순', true],
  ['필지 적합도', '경축별 점수', false],
  ['출하 이력 분석', '적중률·수익', false],
] as Array<[string, string, boolean]>;

const STATE_PILL = {
  proc: 'bg-info-bg text-info',
  done: 'bg-group-top-bg text-group-top',
  fail: 'bg-group-low-bg text-group-low',
};
const STATE_LABEL = { proc: '생성 중', done: '완료', fail: '실패' };

export default function ReportsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'UNION_ADMIN';

  const unionId = useAuthStore((s) => s.user?.unionId) ?? '';
  const { data: me } = useMe();
  const myMemberId = me?.memberId;
  const qc = useQueryClient();
  const types = isAdmin ? ADMIN_TYPES : MEMBER_TYPES;
  const sections = isAdmin ? SECTIONS_ADMIN : SECTIONS_MEMBER;
  const [selType, setSelType] = useState(types[0].key);
  const [secs, setSecs] = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map(([nm, , on]) => [nm, on]))
  );
  const [fmt, setFmt] = useState<'PDF' | 'XLSX'>('PDF');
  const [period, setPeriod] = useState('2026-05');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiTitle, setAiTitle] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  const aiStatusQ = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => aiApi.status().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
  const reportsQ = useQuery({
    queryKey: ['reports', 'list', unionId, isAdmin],
    queryFn: () =>
      reportsApi.getList(isAdmin ? { unionId } : {}).then((r) => r.data.data),
    enabled: !!unionId,
  });

  const [histPeriod, setHistPeriod] = useState<'1w' | '1m' | '3m' | '6m' | '1y' | 'all'>('1m');
  const [histModal, setHistModal] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    try { setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]')); } catch { /* noop */ }
  }, []);
  const persistDismissed = (arr: string[]) => {
    const uniq = [...new Set(arr)];
    setDismissed(uniq);
    if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, JSON.stringify(uniq));
  };
  const dismissReport = (id: string) => { persistDismissed([...dismissed, id]); toast.success('이력에서 삭제했습니다'); };

  const hist = (reportsQ.data ?? [])
    .filter((r) => !dismissed.includes(r.reportId))
    .map((r) => ({
    _id: r.reportId,
    state: REPORT_STATE[r.status] ?? 'done',
    name: `${r.period} ${REPORT_TYPE_LABEL[r.type] ?? '리포트'}`,
    meta: `${fmtDate(r.createdAt)} · ${r.format}`,
    createdAt: r.createdAt,
    type: r.type,
    period: r.period,
    downloadUrl: r.downloadUrl,
  }));
  const PERIOD_DAYS: Record<string, number> = { '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
  const shownHist = histPeriod === 'all'
    ? hist
    : hist.filter((h) => {
        const t = new Date(h.createdAt).getTime();
        return Number.isNaN(t) || t >= Date.now() - PERIOD_DAYS[histPeriod] * 86400000;
      });

  const generate = useMutation({
    mutationFn: () =>
      reportsApi.generate({
        type: toReportType(selType),
        unionId: isAdmin ? unionId : undefined,
        period,
        format: fmt as ReportFormat,
        sections: Object.keys(secs).filter((k) => secs[k]),
        force: true,
      }),
    onSuccess: () => {
      toast.success('리포트 생성을 요청했습니다');
      setTimeout(() => qc.invalidateQueries({ queryKey: ['reports', 'list', unionId, isAdmin] }), 1500);
    },
    onError: () => {
      // 이미 존재하는 리포트가 dismissed 처리돼 있을 수 있으므로 초기화 후 재조회
      persistDismissed([]);
      qc.invalidateQueries({ queryKey: ['reports', 'list', unionId, isAdmin] });
      toast.error('리포트 생성에 실패했습니다. 기존 이력을 확인해 주세요.');
    },
  });
  const busy = generate.isPending;

  const previewAI = async () => {
    const t = types.find((x) => x.key === selType);
    setAiOpen(true);
    setAiBusy(true);
    setAiText('');
    try {
      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeKey: selType, typeName: t?.nm, period, role,
          sections: Object.keys(secs).filter((k) => secs[k]),
        }),
      });
      const d = await res.json();
      setAiTitle(d.title ?? '');
      setAiText(d.text ?? '');
    } catch {
      setAiText('생성에 실패했습니다.');
    } finally {
      setAiBusy(false);
    }
  };

  const genReport = () => {
    if (busy) return;
    generate.mutate();
  };

  // 실제 데이터로 채운 인쇄용 리포트 뷰를 새 탭에서 열기 (브라우저 인쇄 → PDF 저장)
  const openPrintReport = () => {
    const params = new URLSearchParams({
      type: toReportType(selType),
      period,
      unionId,
      sections: Object.keys(secs).filter((k) => secs[k]).join(','),
    });
    window.open(`/report-print?${params.toString()}`, '_blank');
  };

  const onRowAction = (h: { _id?: string; state: string; name: string; type?: string; period?: string }) => {
    if (h.state === 'proc') {
      toast('생성 중인 리포트입니다');
    } else if (h.state === 'fail') {
      generate.mutate();
    } else {
      // 백엔드 다운로드 PDF는 스텁이라, 실데이터 + AI 본문(id)을 렌더하는 인쇄 뷰로 연다
      const params = new URLSearchParams({ type: h.type ?? 'MONTHLY', period: h.period ?? period, unionId });
      if (h._id) params.set('id', h._id);
      window.open(`/report-print?${params.toString()}`, '_blank');
    }
  };

  const procCount = hist.filter((h) => h.state === 'proc').length;
  const doneCount = hist.filter((h) => h.state === 'done').length;
  const failCount = hist.filter((h) => h.state === 'fail').length;
  const stats = isAdmin
    ? [
        ['총 생성', `${hist.length}건`, FileText, 'bg-brand-soft text-brand-deep'],
        ['생성 중', `${procCount}건`, Clock, 'bg-info-bg text-info'],
        ['완료', `${doneCount}건`, Check, 'bg-group-top-bg text-group-top'],
        ['실패', `${failCount}건`, X, 'bg-group-low-bg text-group-low'],
      ]
    : [
        ['받은 리포트', `${hist.length}건`, FileText, 'bg-brand-soft text-brand-deep'],
        ['생성 중', `${procCount}건`, Clock, 'bg-info-bg text-info'],
        ['완료', `${doneCount}건`, Check, 'bg-group-top-bg text-group-top'],
        ['실패', `${failCount}건`, Download, 'bg-group-low-bg text-group-low'],
      ];

  return (
    <>
      <PageHead
        title="리포트"
        description={
          isAdmin
            ? '조합 월간 리포트와 조합원 액션플랜을 자동으로 만들어 받습니다.'
            : '조합 운영과 조합원 성과를 정리한 자료를 자동으로 만들어 받아볼 수 있습니다.'
        }
      />

      {/* 통계 */}
      <div className="grid grid-cols-4 max-[1180px]:grid-cols-2 max-[720px]:grid-cols-1 gap-3 mb-3.5">
        {stats.map(([k, v, Icon, ic]: any) => (
          <div key={k} className={`${cardCls} flex items-center gap-3.5 p-4!`}>
            <div className={clsx('w-10 h-10 rounded-[10px] grid place-items-center flex-none', ic)}>
              <Icon size={20} />
            </div>
            <div>
              <div className="text-[11.5px] text-fg-muted font-bold tracking-wider uppercase">{k}</div>
              <div className="text-[22px] font-extrabold tracking-tight mt-0.5">{v}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] max-[1180px]:grid-cols-1 gap-3.5">
        {/* 빌더 */}
        <section className="bg-white border border-border-soft rounded-xl p-5.5">
          <div className="mb-5.5">
            <div className="text-[10.5px] font-extrabold tracking-widest text-fg-muted uppercase mb-3">1단계 · 유형 선택</div>
            <div className={clsx('grid gap-2 max-[720px]:grid-cols-1', isAdmin ? 'grid-cols-3' : 'grid-cols-2')}>
              {types.map((t) => {
                const on = selType === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setSelType(t.key)}
                    className={clsx(
                      'p-3.5 pb-3 border-1.5 rounded-xl text-left transition-all',
                      on ? 'bg-brand-soft border-brand' : 'bg-white border-border-soft hover:border-brand hover:-translate-y-px'
                    )}
                  >
                    <span
                      className={clsx(
                        'inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider mb-2',
                        on ? 'bg-brand text-white' : 'bg-bg-soft text-fg-soft'
                      )}
                    >
                      {t.tag}
                    </span>
                    <div className="font-extrabold text-[13.5px]">{t.nm}</div>
                    <div className="text-[11.5px] text-fg-muted mt-1 leading-snug">{t.ds}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-5.5">
            <div className="text-[10.5px] font-extrabold tracking-widest text-fg-muted uppercase mb-3">2단계 · 옵션</div>
            <div className="grid grid-cols-3 max-[720px]:grid-cols-1 gap-3">
              {isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-fg-soft mb-1.5">대상</label>
                  <div className="relative">
                    <select className="appearance-none w-full pl-3 pr-9 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] cursor-pointer">
                      <option>조합 전체</option><option>조합원 선택…</option>
                    </select>
                    <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-fg-soft mb-1.5">기간</label>
                <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-fg-soft mb-1.5">형식</label>
                <div className="inline-flex bg-bg-soft border border-border-soft rounded-lg overflow-hidden">
                  {(['PDF', 'XLSX'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFmt(f)}
                      className={clsx('px-3 py-1.5 font-semibold text-[13px]', fmt === f ? 'bg-brand text-white' : 'text-fg-soft')}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-5.5">
            <div className="text-[10.5px] font-extrabold tracking-widest text-fg-muted uppercase mb-3">3단계 · 포함 섹션</div>
            <div className={clsx('grid gap-2', isAdmin ? 'grid-cols-3 max-[720px]:grid-cols-1' : 'grid-cols-2 max-[720px]:grid-cols-1')}>
              {sections.map(([nm, ds]) => {
                const on = secs[nm];
                return (
                  <label
                    key={nm}
                    className={clsx(
                      'flex items-start gap-2.5 px-3 py-2.5 rounded-[9px] border cursor-pointer',
                      on ? 'bg-brand-soft border-brand' : 'bg-white border-border-soft hover:bg-bg-soft hover:border-brand-soft'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setSecs((s) => ({ ...s, [nm]: !s[nm] }))}
                      className="sr-only"
                    />
                    <span
                      className={clsx(
                        'mt-0.5 w-5 h-5 rounded-md grid place-items-center flex-none border transition-colors',
                        on ? 'bg-brand border-brand text-white' : 'bg-white border-border-soft text-transparent'
                      )}
                    >
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <div>
                      <div className="font-bold text-[13px]">{nm}</div>
                      <div className="text-[11px] text-fg-muted mt-0.5">{ds}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 items-start pt-3.5 border-t border-border-soft mt-4.5">
            <span className="text-xs text-fg-muted">
              예상 생성 시간 약 {isAdmin ? '35' : '20'}초 · 예상 파일 크기 {isAdmin ? '4' : '1'}MB
            </span>
            <div className="flex items-center gap-2">
              {aiStatusQ.data && (
                <span className={clsx('inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold', aiStatusQ.data.configured ? 'bg-brand-soft text-brand-deep' : 'bg-bg-soft text-fg-muted')}>
                  <Sparkles size={11} /> AI {aiStatusQ.data.configured ? aiStatusQ.data.model : '미설정'}
                </span>
              )}
              <button type="button" className={btnCls} onClick={previewAI}><Sparkles size={14} /> AI 미리보기</button>
              <button type="button" className={btnCls} onClick={openPrintReport}><Printer size={14} /> PDF 미리보기</button>
              <button type="button" className={btnPrimaryCls} onClick={genReport}>+ 리포트 생성</button>
            </div>
          </div>
        </section>

        {/* 우측 이력 */}
        <section className="bg-white border border-border-soft rounded-xl flex flex-col overflow-hidden">
          <div className="flex justify-between items-center px-4.5 py-4 border-b border-border-soft">
            <div className="text-[14.5px] font-bold">{isAdmin ? '생성 이력' : '받은 리포트'}</div>
            <button type="button" className={btnSmCls} onClick={() => setHistModal(true)}>전체 보기</button>
          </div>
          <div className="flex gap-1 px-4.5 py-2.5 border-b border-border-soft overflow-x-auto">
            {([['1w', '1주'], ['1m', '1개월'], ['3m', '3개월'], ['6m', '6개월'], ['1y', '1년']] as Array<['1w' | '1m' | '3m' | '6m' | '1y', string]>).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setHistPeriod(k)} className={histPeriod === k ? chipOnCls : chipCls}>
                {label}
              </button>
            ))}
          </div>
          <div className="p-2 max-h-180 overflow-y-auto">
            {shownHist.length === 0 && (
              <div className="px-3 py-8 text-center text-[13px] text-fg-muted">해당 기간 이력이 없습니다.</div>
            )}
            {shownHist.map((h, i) => (
              <div key={i} onClick={() => onRowAction(h)} className="grid grid-cols-[auto_1fr_auto] gap-3 p-3 rounded-[10px] items-center cursor-pointer hover:bg-bg-soft">
                <div
                  className={clsx(
                    'w-9 h-9 rounded-[9px] grid place-items-center flex-none relative',
                    h.state === 'proc' && 'bg-info-bg text-info border-1.5 border-info/22',
                    h.state === 'done' && 'bg-[#f3f4f6] text-[#6b7280]',
                    h.state === 'fail' && 'bg-group-low-bg text-group-low'
                  )}
                >
                  {/* marching ants for proc */}
                  {h.state === 'proc' && (
                    <svg viewBox="0 0 36 36" preserveAspectRatio="none" className="absolute -inset-1.5 w-[calc(100%+0.75rem)] h-[calc(100%+0.75rem)] pointer-events-none">
                      <rect
                        x="1" y="1" width="34" height="34" rx="8" ry="8"
                        fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"
                        pathLength="100" strokeDasharray="22 78"
                        style={{ animation: 'march 1.6s linear infinite' }}
                      />
                    </svg>
                  )}
                  <FileText size={16} />
                </div>
                <div>
                  <div className="font-bold text-[13px]">{h.name}</div>
                  <div className="text-[11.5px] text-fg-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className={clsx('px-1.5 py-0.5 rounded-full text-[10.5px] font-extrabold', STATE_PILL[h.state])}>
                      {STATE_LABEL[h.state]}
                    </span>
                    · {h.meta}
                  </div>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); onRowAction(h); }} className="w-8 h-8 rounded-md border border-border-soft bg-white text-fg-soft grid place-items-center hover:bg-bg-soft hover:text-fg hover:border-border-strong">
                  {h.state === 'proc' ? <X size={14} /> : h.state === 'fail' ? <RotateCcw size={14} /> : <Download size={14} />}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* AI 생성 리포트 미리보기 */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" onClick={() => setAiOpen(false)}>
          <div className="bg-white rounded-2xl border border-border-soft flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-soft">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-soft text-brand-deep text-[10.5px] font-extrabold">
                  <Sparkles size={11} /> AI 생성
                </span>
                <span className="font-bold text-[14px]">{aiTitle || 'AI 리포트 미리보기'}</span>
              </div>
              <button type="button" onClick={() => setAiOpen(false)} className="w-7 h-7 rounded-md border border-border-soft text-fg-muted hover:bg-bg-soft"><X size={14} className="mx-auto" /></button>
            </div>
            <div className="px-5 py-4 overflow-y-auto text-[13px] leading-relaxed whitespace-pre-wrap text-fg">
              {aiBusy ? (
                <div className="py-10 text-center text-fg-muted">AI가 데이터를 분석해 리포트를 작성 중…</div>
              ) : (
                aiText
              )}
            </div>
          </div>
        </div>
      )}

      {/* 생성 이력 전체 보기 모달 */}
      {histModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" onClick={() => setHistModal(false)}>
          <div className="bg-white rounded-2xl border border-border-soft w-[560px] max-w-full max-h-[82vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-soft">
              <div className="font-bold text-[15px]">{isAdmin ? '생성 이력' : '받은 리포트'} <span className="text-fg-muted font-semibold text-[13px]">{hist.length}건</span></div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setConfirmClear(true)} disabled={hist.length === 0} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border-soft text-danger text-[12.5px] font-semibold hover:bg-danger-bg disabled:opacity-40">
                  <Trash2 size={13} /> 전체 삭제
                </button>
                <button type="button" onClick={() => setHistModal(false)} className="w-7 h-7 rounded-md border border-border-soft text-fg-muted hover:bg-bg-soft"><X size={14} className="mx-auto" /></button>
              </div>
            </div>
            <div className="p-2 overflow-y-auto">
              {hist.length === 0 && <div className="px-3 py-10 text-center text-[13px] text-fg-muted">이력이 없습니다.</div>}
              {hist.map((h) => (
                <div key={h._id} className="grid grid-cols-[auto_1fr_auto_auto] gap-3 p-3 rounded-[10px] items-center hover:bg-bg-soft">
                  <div onClick={() => onRowAction(h)} className="w-9 h-9 rounded-[9px] grid place-items-center flex-none bg-[#f3f4f6] text-[#6b7280] cursor-pointer"><FileText size={16} /></div>
                  <div onClick={() => onRowAction(h)} className="min-w-0 cursor-pointer">
                    <div className="font-bold text-[13px] truncate">{h.name}</div>
                    <div className="text-[11.5px] text-fg-muted mt-0.5"><span className={clsx('px-1.5 py-0.5 rounded-full text-[10.5px] font-extrabold', STATE_PILL[h.state])}>{STATE_LABEL[h.state]}</span> · {h.meta}</div>
                  </div>
                  <button type="button" onClick={() => onRowAction(h)} title="열기" className="w-8 h-8 rounded-md border border-border-soft bg-white text-fg-soft grid place-items-center hover:bg-bg-soft hover:text-fg"><Download size={14} /></button>
                  <button type="button" onClick={() => setPendingDelete({ id: h._id, name: h.name })} title="이력 삭제" className="w-8 h-8 rounded-md border border-border-soft bg-white text-danger grid place-items-center hover:bg-danger-bg"><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 개별 이력 삭제 확인 모달 */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" onClick={() => setPendingDelete(null)}>
          <div className="bg-white rounded-2xl border border-border-soft w-[400px] max-w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-full bg-danger-bg text-danger grid place-items-center mx-auto mb-4"><Trash2 size={20} /></div>
            <div className="text-[16px] font-extrabold mb-1.5">이력 삭제</div>
            <div className="text-[13px] text-fg-muted leading-relaxed mb-5"><b className="text-danger font-extrabold">{pendingDelete.name}</b> 이력을 삭제합니다. 이 작업은 되돌릴 수 없습니다.</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPendingDelete(null)} className={`${btnCls} flex-1 justify-center`}>취소</button>
              <button
                type="button"
                onClick={() => { dismissReport(pendingDelete.id); setPendingDelete(null); }}
                className="flex-1 justify-center inline-flex items-center px-3 py-2.5 rounded-[9px] bg-danger text-white font-bold text-[13.5px] hover:opacity-90"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전체 삭제 확인 모달 */}
      {confirmClear && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" onClick={() => setConfirmClear(false)}>
          <div className="bg-white rounded-2xl border border-border-soft w-[400px] max-w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-full bg-danger-bg text-danger grid place-items-center mx-auto mb-4"><Trash2 size={20} /></div>
            <div className="text-[16px] font-extrabold mb-1.5">생성 이력 전체 삭제</div>
            <div className="text-[13px] text-fg-muted leading-relaxed mb-5">현재 목록의 <b className="text-danger font-extrabold">{hist.length}건</b>을 이력에서 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmClear(false)} className={`${btnCls} flex-1 justify-center`}>취소</button>
              <button
                type="button"
                onClick={() => { persistDismissed([...dismissed, ...hist.map((h) => h._id)]); setConfirmClear(false); setHistModal(false); toast.success('전체 이력을 삭제했습니다'); }}
                className="flex-1 justify-center inline-flex items-center px-3 py-2.5 rounded-[9px] bg-danger text-white font-bold text-[13.5px] hover:opacity-90"
              >
                전체 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
