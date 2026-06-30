'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
  GitBranch, Play, TrendingUp, TrendingDown, AlertTriangle,
  Save, Trash2, Info, Check, X,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { PageHead } from '@/components/shared/PageHead';
import { RoleGuard } from '@/components/shared/RoleGuard';
import { scenariosApi } from '@/lib/api/scenarios';
import { membersApi } from '@/lib/api/members';
import type { MemberItem } from '@/lib/api/members';
import { landsApi } from '@/lib/api/lands';
import { useAuthStore } from '@/lib/store/authStore';
import { useMe } from '@/lib/hooks/useMe';
import type { Land, LandSuitabilityCandidate } from '@/types/land';
import type { ScenarioSimulateResponse } from '@/types/scenario';

const card = 'bg-white border border-[#e5e7e0] rounded-2xl overflow-hidden';
const inputCls = 'w-full border border-[#e5e7e0] rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#C7D0D7]/40 focus:border-[#8FA0AE] bg-white';
const sectionLabel = 'text-[10.5px] font-extrabold tracking-widest text-fg-muted uppercase';

const RISK_LABEL: Record<string, string> = {
  INITIAL_INVESTMENT: '초기 투자비',
  MARKET_RISK: '시장 변동',
  WEATHER_RISK: '기상 리스크',
  LABOR_RISK: '노동력 부족',
  REGULATORY: '제도·규정',
};

/* 작목 카테고리 분류 및 색상 */
type CropCategory = '축산' | '과수' | '채소' | '식량' | '특용';

const CATEGORY_STYLE: Record<CropCategory, { bg: string; border: string; badge: string; text: string; label: string }> = {
  축산: { bg: '#FFF7ED', border: '#FDBA74', badge: '#EA580C18', text: '#EA580C', label: '축산' },
  과수: { bg: '#FEF9C3', border: '#FDE047', badge: '#CA8A0418', text: '#CA8A04', label: '과수' },
  채소: { bg: '#F0FDF4', border: '#86EFAC', badge: '#16A34A18', text: '#16A34A', label: '채소' },
  식량: { bg: '#EFF6FF', border: '#93C5FD', badge: '#2563EB18', text: '#2563EB', label: '식량' },
  특용: { bg: '#FAF5FF', border: '#C4B5FD', badge: '#7C3AED18', text: '#7C3AED', label: '특용' },
};

const LIVESTOCK_KW = ['한우', '젖소', '돼지', '닭', '오리', '염소', '양', '토끼', '흑염소', '소', '육우', '육계', '산란계', '토종닭', '오계', '계', '가금', '축'];
const FRUIT_KW = ['사과', '배', '포도', '복숭아', '감', '귤', '오렌지', '키위', '자두', '매실', '살구', '체리', '블루베리', '딸기', '참외', '수박'];
const VEG_KW = ['배추', '무', '고추', '마늘', '양파', '파', '상추', '시금치', '당근', '오이', '토마토', '깻잎', '호박', '가지', '콩나물'];
const GRAIN_KW = ['벼', '쌀', '보리', '밀', '콩', '팥', '옥수수', '감자', '고구마', '메밀'];

function cropCategory(name: string): CropCategory {
  const hit = (kw: string[]) => kw.some((k) => k.length >= 2 ? name.includes(k) : name === k);
  if (hit(LIVESTOCK_KW)) return '축산';
  if (hit(FRUIT_KW)) return '과수';
  if (hit(VEG_KW)) return '채소';
  if (hit(GRAIN_KW)) return '식량';
  return '특용';
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

function AnimatedDots() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setCount((c) => (c % 3) + 1), 450);
    return () => clearInterval(id);
  }, []);
  return <span className="inline-block w-[14px] text-left">{'.'.repeat(count)}</span>;
}

function ResultPanel({ result, title, accentColor }: { result: ScenarioSimulateResponse; title: string; accentColor: string }) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const saveMut = useMutation({
    mutationFn: () => scenariosApi.save({ scenarioId: result.scenarioId, name: title }),
    onSuccess: () => { toast.success('시나리오를 저장했습니다'); setSaved(true); qc.invalidateQueries({ queryKey: ['scenarios', 'saved'] }); },
    onError: () => toast.error('저장에 실패했습니다'),
  });
  const chartData = [
    { period: '현재', score: Number(result.baseline.score.toFixed(1)), projected: false },
    ...result.timeline.map((t) => ({ period: t.period, score: Number(t.score.toFixed(1)), projected: true })),
  ];
  const allScores = chartData.map(d => d.score);
  const chartMin = Math.max(0, Math.floor(Math.min(...allScores) - 10));
  const chartMax = Math.ceil(Math.max(...allScores) + 5);
  const up = result.delta.revenuePct >= 0;
  const sUp = result.delta.scorePoint >= 0;
  return (
    <div className={clsx(card, 'flex flex-col h-full')}>
      <div className="px-5 py-4 border-b border-[#e5e7e0] flex items-center justify-between flex-none">
        <div className={sectionLabel}>시나리오 결과</div>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-soft text-brand-deep">
          신뢰도 {Math.round(result.confidence * 100)}%
        </span>
      </div>
      <div className="p-5 flex flex-col gap-5 overflow-y-auto flex-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#f9faf8] border border-[#e5e7e0] rounded-xl p-4">
            <div className={clsx(sectionLabel, 'mb-2')}>현재</div>
            <div className="text-[24px] font-extrabold text-fg tracking-tight leading-none">
              {result.baseline.score.toFixed(1)}<span className="text-[14px] ml-1">점</span>
            </div>
            <div className="text-[12px] text-fg-muted mt-1.5">{result.baseline.annualRevenue.toLocaleString()}원/년</div>
          </div>
          <div className="rounded-xl p-4 border" style={{ background: `${accentColor}10`, borderColor: `${accentColor}40` }}>
            <div className="text-[10.5px] font-extrabold tracking-widest uppercase mb-2" style={{ color: accentColor }}>예측</div>
            <div className="text-[24px] font-extrabold tracking-tight leading-none" style={{ color: accentColor }}>
              {result.projected.score.toFixed(1)}<span className="text-[14px] ml-1">점</span>
            </div>
            <div className="text-[12px] mt-1.5" style={{ color: accentColor }}>{result.projected.annualRevenue.toLocaleString()}원/년</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '성과율 변화', val: `${sUp ? '+' : ''}${result.delta.scorePoint.toFixed(1)}점`, up: sUp },
            { label: '수익 변화율', val: `${up ? '+' : ''}${result.delta.revenuePct.toFixed(1)}%`, up },
            { label: '수익 증감', val: `${result.delta.revenue >= 0 ? '+' : ''}${(result.delta.revenue / 10000).toFixed(0)}만`, up: result.delta.revenue >= 0 },
          ].map(({ label, val, up: isUp }) => (
            <div key={label} className="bg-[#f9faf8] border border-[#e5e7e0] rounded-xl p-3 text-center">
              <div className="text-[10px] text-fg-muted font-semibold mb-1">{label}</div>
              <div className="text-[14px] font-extrabold flex items-center justify-center gap-0.5" style={{ color: isUp ? accentColor : '#d23f3f' }}>
                {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{val}
              </div>
            </div>
          ))}
        </div>
        {chartData.length > 0 && (
          <div>
            <div className={clsx(sectionLabel, 'mb-3')}>분기별 성과율 추이</div>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#8FA0AE' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8FA0AE' }} axisLine={false} tickLine={false} domain={[chartMin, chartMax]} width={28} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7e0' }} formatter={(v: number) => [`${v}점`, '성과율']} />
                  <ReferenceLine y={result.baseline.score} stroke="#C7D0D7" strokeDasharray="4 3" strokeOpacity={0.7} />
                  <Line type="monotone" dataKey="score" stroke={accentColor} strokeWidth={2.5}
                    dot={{ r: 3.5, fill: accentColor, stroke: 'white', strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: accentColor, stroke: 'white', strokeWidth: 1.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {result.risks.length > 0 && (
          <div>
            <div className={clsx(sectionLabel, 'mb-2.5 flex items-center gap-1.5')}>
              <AlertTriangle size={11} className="text-amber-500" />리스크 요인
            </div>
            <div className="flex flex-col gap-1.5">
              {result.risks.map((r, i) => (
                <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
                  <span className="text-[11.5px] font-bold text-amber-700 flex-none">{RISK_LABEL[r.type] ?? r.type}</span>
                  {r.amount > 0 && <span className="text-[11.5px] font-semibold text-amber-600 flex-none">{r.amount.toLocaleString()}원</span>}
                  <span className="text-[11.5px] text-amber-600">{r.note}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {result.aiAdvice && (
          <div className="rounded-xl p-4 flex flex-col gap-2 border" style={{ background: `${accentColor}08`, borderColor: `${accentColor}30` }}>
            <div className="flex items-center gap-1.5 text-[12px] font-extrabold" style={{ color: accentColor }}>
              <Info size={13} />AI 분석 요약
            </div>
            <div className="max-h-[160px] overflow-y-auto flex flex-col gap-2 pr-1">
              <p className="text-[12.5px] leading-relaxed text-fg-muted">{result.aiAdvice.summary}</p>
              {result.aiAdvice.actions.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {result.aiAdvice.actions.map((a, i) => (
                    <li key={i} className="text-[12px] text-[#3a6040] flex items-start gap-1.5">
                      <span className="flex-none mt-0.5" style={{ color: accentColor }}>•</span>{a}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || saved}
          className={clsx(
            'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-colors',
            saved ? 'cursor-default border disabled:opacity-80' : 'text-white disabled:opacity-50',
          )}
          style={saved
            ? { background: accentColor + '18', color: accentColor, borderColor: accentColor + '40' }
            : { background: accentColor }}
        >
          <Save size={14} />{saveMut.isPending ? '저장 중…' : saved ? '저장됨' : '시나리오 저장'}
        </button>
      </div>
    </div>
  );
}

function EmptyResult({ savedScenario, accentColor }: { savedScenario: { result: ScenarioSimulateResponse; name: string } | null; accentColor: string }) {
  if (savedScenario) return <ResultPanel result={savedScenario.result} title={savedScenario.name} accentColor={accentColor} />;
  return (
    <div className={clsx(card, 'flex flex-col h-full')}>
      <div className="px-5 py-4 border-b border-[#e5e7e0]">
        <div className={sectionLabel}>시나리오 결과</div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <GitBranch size={36} className="text-[#e5e7e0]" />
        <p className="text-[13px] text-fg-muted">시뮬레이션을 실행하거나 저장된 시나리오를 클릭하세요</p>
      </div>
    </div>
  );
}

function CropCandidatePicker({
  fromCrop,
  toCrop,
  setToCrop,
  candidates,
  suitabilityLoading,
  disabled,
  accentColor,
}: {
  fromCrop: string;
  toCrop: string;
  setToCrop: (v: string) => void;
  candidates: LandSuitabilityCandidate[];
  suitabilityLoading: boolean;
  disabled: boolean;
  accentColor: string;
}) {
  const noChange = !toCrop || toCrop === fromCrop;

  // 카테고리별 그룹핑 (순서 유지)
  const ORDER: CropCategory[] = ['축산', '과수', '채소', '식량', '특용'];
  const grouped = ORDER.map((cat) => ({
    cat,
    items: candidates.filter((c) => cropCategory(c.crop) === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-fg-muted">전환 작목</span>

      </div>

      {suitabilityLoading && !disabled ? (
        <div className="py-4 text-center text-[11.5px] text-fg-muted">적합도 분석 중…</div>
      ) : (
        <div className="flex flex-col gap-3 max-h-[200px] overflow-y-auto pr-1">
          {grouped.map(({ cat, items }) => {
            const style = CATEGORY_STYLE[cat];
            return (
              <div key={cat}>
                {/* 카테고리 소제목 */}
                <div
                  className="inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded mb-1.5"
                  style={{ color: style.text, background: style.badge }}
                >
                  {style.label}
                </div>
                {/* 2열 카드 */}
                <div className="grid grid-cols-2 gap-2">
                  {items.map((c) => {
                    const selected = toCrop === c.crop;

                    return (
                      <button
                        key={c.crop}
                        type="button"
                        onClick={() => setToCrop(c.crop)}
                        disabled={disabled}
                        className={clsx(
                          'flex flex-col gap-1.5 px-3 py-3 rounded-xl border text-left transition-all',
                          selected
                            ? 'border-[#8FA0AE] bg-[#f4f6f8]'
                            : 'border-[#e5e7e0] bg-white hover:border-[#C7D0D7] hover:bg-[#f9faf8]',
                          disabled && 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[12px] font-bold text-fg leading-tight">{c.crop}</span>
                          <span
                            className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full flex-none"
                            style={{ color: accentColor, background: `${accentColor}1a` }}
                          >
                            {c.score}점
                          </span>
                        </div>
                        {(c.marketPrice || c.estimatedYield) && (
                          <div className="flex flex-wrap gap-x-2 text-[10.5px] text-fg-muted">
                            {c.marketPrice && <span>{(c.marketPrice / 10000).toFixed(0)}만원</span>}
                            {c.estimatedYield && <span>{c.estimatedYield}kg</span>}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 선택 안함 */}
      <div
        className={clsx('flex items-center gap-2 mt-0.5 cursor-pointer select-none', disabled && 'opacity-40 pointer-events-none')}
        onClick={() => setToCrop(fromCrop)}
      >
        <div
          className="w-4 h-4 rounded flex items-center justify-center border-2 flex-none transition-colors"
          style={noChange
            ? { background: accentColor, borderColor: accentColor }
            : { background: 'white', borderColor: '#d1d5db' }}
        >
          {noChange && <Check size={10} strokeWidth={3} className="text-white" />}
        </div>
        <span className="text-[12px] text-fg-muted">
          선택 안함{fromCrop ? ` — ${fromCrop} 유지` : ''}
        </span>
      </div>
    </div>
  );
}

function ScenariosContent() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'UNION_ADMIN';
  const accentColor = isAdmin ? '#41AA4D' : '#2563eb';
  const { data: me } = useMe();
  const myMemberId = me?.memberId ?? '';
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const initLandId = searchParams.get('landId');
  const initMemberId = searchParams.get('memberId');

  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const { data: members } = useQuery({
    queryKey: ['members', 'list'],
    queryFn: () => membersApi.list().then((r) => r.data.data ?? []),
    enabled: isAdmin,
  });
  const targetMemberId = isAdmin ? (selectedMember?.memberId ?? '') : myMemberId;

  useEffect(() => {
    if (!initMemberId || !members?.length || !isAdmin) return;
    const member = members.find((m: MemberItem) => m.memberId === initMemberId);
    if (member) setSelectedMember(member);
  }, [members, initMemberId, isAdmin]);

  const [selectedLand, setSelectedLand] = useState<Land | null>(null);
  const { data: lands, isLoading: landsLoading } = useQuery({
    queryKey: ['lands', 'by-member', targetMemberId],
    queryFn: () => landsApi.getByMember(targetMemberId).then((r) => r.data.data ?? []),
    enabled: isAdmin ? !!selectedMember?.memberId : !!myMemberId,
  });

  useEffect(() => {
    if (!initLandId || !lands?.length) return;
    const land = lands.find((l: Land) => l.landId === initLandId);
    if (land) handleSelectLand(land);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lands, initLandId]);

  const { data: suitability, isLoading: suitabilityLoading } = useQuery({
    queryKey: ['suitability', selectedLand?.landId],
    queryFn: () => landsApi.getSuitability(selectedLand!.landId).then((r) => r.data.data),
    enabled: !!selectedLand?.landId,
    staleTime: 1000 * 60 * 5,
  });
  const candidates: LandSuitabilityCandidate[] = suitability?.candidates ?? [];

  const [fromCrop, setFromCrop] = useState('');
  const [toCrop, setToCrop] = useState('');
  const [ratio, setRatio] = useState(100);
  const [startPeriod, setStartPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [scenarioTitle, setScenarioTitle] = useState('');

  const handleSelectLand = (land: Land) => {
    setSelectedLand(land);
    const crop = land.mainCrop ?? '';
    setFromCrop(crop);
    setToCrop(crop);
    setScenarioTitle(`${land.name} 시나리오`);
    setResult(null);
    setViewedSaved(null);
  };

  const [result, setResult] = useState<ScenarioSimulateResponse | null>(null);
  const [viewedSaved, setViewedSaved] = useState<{ result: ScenarioSimulateResponse; name: string } | null>(null);

  const { mutate: runSim, isPending } = useMutation({
    mutationFn: () =>
      scenariosApi.simulate({
        memberId: targetMemberId,
        landId: selectedLand!.landId,
        changes: { fromCrop, toCrop, applyAreaRatio: ratio / 100, startPeriod },
      }).then((r) => r.data.data),
    onSuccess: (data) => { setResult(data); setViewedSaved(null); },
    onError: () => toast.error('시뮬레이션에 실패했습니다'),
  });
  const canRun = !!selectedLand && !!fromCrop.trim() && !isPending;

  const { data: savedList, isLoading: savedLoading } = useQuery({
    queryKey: ['scenarios', 'saved', targetMemberId],
    queryFn: () => scenariosApi.list({ memberId: targetMemberId || undefined }).then((r) => r.data.data ?? []),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => scenariosApi.remove(id),
    onSuccess: () => { toast.success('삭제했습니다'); qc.invalidateQueries({ queryKey: ['scenarios', 'saved'] }); },
    onError: () => toast.error('삭제에 실패했습니다'),
  });

  const [showListModal, setShowListModal] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const handleClickSaved = async (s: { scenarioId: string; name: string }) => {
    try {
      const res = await scenariosApi.get(s.scenarioId).then((r) => r.data.data);
      if (res?.result) {
        setViewedSaved({ result: res.result, name: res.name });
        setResult(null);
      }
    } catch {
      toast.error('불러오기에 실패했습니다');
    }
  };

  return (
    <>
      <PageHead
        title="개선 시나리오"
        description="필지별 작목 전환을 시뮬레이션하고 AI 분석 결과를 확인합니다."

      />

      <div className="grid grid-cols-2 max-[900px]:grid-cols-1 gap-4 items-stretch">

        <div className={card}>
          <div className="p-5 flex flex-col gap-4">

            {isAdmin && (
              <div>
                <div className={clsx(sectionLabel, 'mb-2')}>1단계 · 조합원 선택</div>
                <select
                  value={selectedMember?.memberId ?? ''}
                  onChange={(e) => {
                    const m = members?.find((m: MemberItem) => m.memberId === e.target.value) ?? null;
                    setSelectedMember(m);
                    setSelectedLand(null);
                    setResult(null);
                    setViewedSaved(null);
                  }}
                  className={inputCls}
                >
                  <option value="">조합원을 선택하세요</option>
                  {members?.map((m: MemberItem) => (
                    <option key={m.memberId ?? m.userId} value={m.memberId ?? ''}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className={clsx(sectionLabel, 'mb-2')}>{isAdmin ? '2단계' : '1단계'} · 필지 선택</div>
              <select
                value={selectedLand?.landId ?? ''}
                onChange={(e) => {
                  const land = lands?.find((l: Land) => l.landId === e.target.value) ?? null;
                  if (land) handleSelectLand(land);
                }}
                disabled={isAdmin ? !selectedMember : false}
                className={inputCls}
              >
                <option value="">
                  {isAdmin && !selectedMember ? '조합원을 먼저 선택하세요' : landsLoading ? '불러오는 중…' : '필지를 선택하세요'}
                </option>
                {(lands ?? []).map((land: Land) => (
                  <option key={land.landId} value={land.landId}>
                    {land.name}{land.mainCrop ? ` (${land.mainCrop})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className={clsx(sectionLabel, 'mb-3')}>{isAdmin ? '3단계' : '2단계'} · 시뮬레이션 설정</div>
              <div className="flex flex-col gap-3">

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-fg-muted">시나리오명</span>
                    <input
                      value={scenarioTitle}
                      onChange={(e) => setScenarioTitle(e.target.value)}
                      placeholder="시나리오명을 입력하세요"
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-fg-muted">시작 시기</span>
                    <input
                      type="month"
                      value={startPeriod}
                      onChange={(e) => setStartPeriod(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                </div>

                <CropCandidatePicker
                  fromCrop={fromCrop}
                  toCrop={toCrop}
                  setToCrop={setToCrop}
                  candidates={candidates}
                  suitabilityLoading={suitabilityLoading}
                  disabled={!selectedLand}
                  accentColor={accentColor}
                />

                <div>
                  <span className="text-[12px] font-semibold text-fg-muted block mb-1.5">적용 면적 ({ratio}%)</span>
                  <input
                    type="range" min={1} max={100} step={1} value={ratio}
                    onChange={(e) => setRatio(Number(e.target.value))}
                    className="w-full range-slider"
                    style={{
                      background: `linear-gradient(to right, ${accentColor} ${ratio}%, #e5e7eb ${ratio}%)`,
                    }}
                  />
                  <div className="flex justify-between text-[10.5px] text-fg-muted mt-1"><span>10%</span><span>100%</span></div>
                </div>

              </div>

              <button
                onClick={() => runSim()}
                disabled={!canRun}
                className={clsx(
                  'w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-[13.5px] font-bold transition-colors',
                  isPending
                    ? 'text-white cursor-not-allowed opacity-90'
                    : canRun
                      ? 'bg-brand hover:bg-brand-deep text-white'
                      : 'bg-[#f9faf8] text-fg-muted border border-[#e5e7e0] cursor-not-allowed',
                )}
                style={isPending ? { background: accentColor } : undefined}
              >
                {isPending
                  ? <>분석 중<AnimatedDots /></>
                  : <><Play size={15} />시뮬레이션 실행</>}
              </button>
            </div>

          </div>
        </div>

        {result
          ? <ResultPanel result={result} title={scenarioTitle || '시나리오'} accentColor={accentColor} />
          : <EmptyResult savedScenario={viewedSaved} accentColor={accentColor} />}
      </div>

      <div className={clsx(card, 'mt-4')}>
        <div className="px-5 py-3.5 border-b border-[#e5e7e0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={sectionLabel}>시나리오 리스트</div>
            {savedList?.length ? <span className="text-[11px] text-fg-muted">{savedList.length}건</span> : null}
          </div>
          {savedList?.length ? (
            <button
              onClick={() => setShowListModal(true)}
              className="text-[11.5px] font-semibold text-fg-muted hover:text-fg transition-colors"
            >
              전체보기
            </button>
          ) : null}
        </div>
        {savedLoading ? (
          <div className="py-10 text-center text-[12px] text-fg-muted">불러오는 중…</div>
        ) : !savedList?.length ? (
          <div className="py-10 flex items-center justify-center gap-2 text-fg-muted">
            <GitBranch size={16} className="text-[#e5e7e0]" />
            <span className="text-[12px]">저장된 시나리오가 없습니다</span>
          </div>
        ) : (
          <div className="px-4 py-4 overflow-x-auto">
            <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
              {savedList.map((s) => (
                <div
                  key={s.scenarioId}
                  onClick={() => handleClickSaved(s)}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-[#e5e7e0] bg-[#f9faf8] hover:border-[#8FA0AE] hover:bg-white transition-all text-left group min-w-[200px] cursor-pointer"
                  style={{ '--accent': accentColor } as React.CSSProperties}
                >
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="text-[13px] font-bold text-fg group-hover:text-[color:var(--accent)] transition-colors max-w-[180px] truncate" title={s.name}>
                      {s.name}
                    </span>
                    <span className="text-[11px] text-fg-muted">{fmtDate(s.createdAt)}</span>
                  </div>
                  <div className="flex items-center flex-none" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => removeMut.mutate(s.scenarioId)}
                      disabled={removeMut.isPending}
                      title="삭제"
                      className="p-1.5 rounded-lg text-fg-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {showListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#e5e7e0] flex-none">
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-[15px]">시나리오 리스트</h2>
                {savedList?.length ? <span className="text-[11px] text-fg-muted">{savedList.length}건</span> : null}
              </div>
              <div className="flex items-center gap-2">
                {savedList?.length ? (
                  <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    className="flex items-center gap-1.5 text-[11.5px] font-semibold text-red-500 hover:text-red-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 size={13} />전체 삭제
                  </button>
                ) : null}
                <button onClick={() => setShowListModal(false)} className="p-1 rounded-lg hover:bg-[#f4f6f8] transition-colors">
                  <X size={16} className="text-fg-muted" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-[#f0f0f0]">
              {!savedList?.length ? (
                <div className="py-12 text-center text-[12px] text-fg-muted">저장된 시나리오가 없습니다</div>
              ) : (savedList ?? []).map((s) => (
                <div key={s.scenarioId} className="flex items-center gap-3 px-6 py-3.5 hover:bg-[#f9faf8] transition-colors">
                  <button
                    onClick={() => { handleClickSaved(s); setShowListModal(false); }}
                    className="flex flex-col gap-0.5 flex-1 text-left min-w-0 group"
                    style={{ '--accent': accentColor } as React.CSSProperties}
                  >
                    <span className="text-[13px] font-bold text-fg group-hover:text-[color:var(--accent)] transition-colors truncate">{s.name}</span>
                    <span className="text-[11px] text-fg-muted">{fmtDate(s.createdAt)}</span>
                  </button>
                  <button
                    onClick={() => removeMut.mutate(s.scenarioId)}
                    disabled={removeMut.isPending}
                    className="p-1.5 rounded-lg text-fg-muted hover:text-red-500 hover:bg-red-50 transition-colors flex-none"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col items-center px-8 pt-8 pb-7 gap-5">
            <div className="w-16 h-16 rounded-full bg-[#fdecec] flex items-center justify-center">
              <Trash2 size={28} className="text-[#d23f3f]" />
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="font-extrabold text-[17px]">시나리오 전체 삭제</h2>
              <p className="text-[13px] text-fg-muted leading-relaxed">
                현재 목록의 <strong className="text-[#d23f3f]">{savedList?.length ?? 0}건</strong>을 이력에서 모두 삭제합니다.<br />이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="flex-1 py-3.5 rounded-2xl border border-[#e5e7e0] text-[14px] font-semibold text-fg hover:bg-[#f4f6f8] transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  Promise.all((savedList ?? []).map((s) => removeMut.mutateAsync(s.scenarioId)))
                    .then(() => { setShowDeleteAllConfirm(false); setShowListModal(false); })
                    .catch(() => {});
                }}
                disabled={removeMut.isPending}
                className="flex-1 py-3.5 rounded-2xl bg-[#d23f3f] hover:bg-[#b83535] text-white text-[14px] font-semibold transition-colors disabled:opacity-60"
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

export default function ScenariosPage() {
  return (
    <RoleGuard allow={['UNION_ADMIN', 'MEMBER']}>
      <ScenariosContent />
    </RoleGuard>
  );
}
