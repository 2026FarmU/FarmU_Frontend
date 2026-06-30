'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { isAxiosError } from 'axios';
import { cardCls } from '@/components/shared/PageHead';
import { dataApi } from '@/lib/api/data';
import { UploadCloud, FileText, Check, AlertTriangle, Download, Clock, Sparkles } from 'lucide-react';

// ── 조합 내부 데이터 유형 (공공데이터에 없는, 조합만 가진 데이터) ──
const DATA_TYPES = [
  { key: 'MEMBER_PERFORMANCE', label: '조합원 성과', cols: ['조합원ID', '이름', '생산성', '출하', '수익성', '품질', '비용효율'] },
  { key: 'SHIPPING_HISTORY', label: '출하 이력', cols: ['조합원ID', '품목', '출하일', '중량kg', '단가', '금액'] },
  { key: 'LIVESTOCK', label: '가축', cols: ['조합원ID', '축종', '두수', '개체ID', '체중kg'] },
  { key: 'SALES', label: '매출', cols: ['조합원ID', '일자', '품목', '수량', '매출액'] },
  { key: 'LAND', label: '필지', cols: ['조합원ID', '필지명', 'PNU', '주소', '면적㎡', '작목'] },
] as const;
const DT = Object.fromEntries(DATA_TYPES.map((d) => [d.key, d])) as Record<string, (typeof DATA_TYPES)[number]>;

const STATUS = {
  APPLIED: { label: '반영됨', pill: 'bg-group-top-bg text-group-top', icon: Check },
  VALIDATED: { label: '검증 완료', pill: 'bg-info-bg text-info', icon: Check },
  VALIDATING: { label: '검증 중', pill: 'bg-warn-bg text-warn', icon: Clock },
  FAILED: { label: '실패', pill: 'bg-group-low-bg text-group-low', icon: AlertTriangle },
  DRAFT:  { label: 'AI 초안', pill: 'bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]', icon: Sparkles },
} as Record<string, { label: string; pill: string; icon: typeof Check }>;
const fmtSize = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)}MB` : `${Math.round(b / 1024)}KB`);

function downloadTemplate(typeKey: string) {
  const t = DT[typeKey];
  if (!t) return;
  const csv = `﻿${t.cols.join(',')}\n`; // 헤더만 (BOM 포함 → 엑셀 한글 정상)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `팜유_${t.label}_양식.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataUploadPanel() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dataType, setDataType] = useState<string>('MEMBER_PERFORMANCE');
  const [dragOver, setDragOver] = useState(false);

  const historyQ = useQuery({
    queryKey: ['data', 'uploads'],
    queryFn: () => dataApi.history({ size: 50 }).then((r) => r.data.data),
  });
  const upload = useMutation({
    mutationFn: (file: File) => dataApi.directUpload(file, dataType),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['data', 'uploads'] }); toast.success('업로드되었습니다. 검증 결과를 확인하세요.'); },
    onError: (e) => toast.error(isAxiosError(e) ? ((e.response?.data as { detail?: string } | undefined)?.detail ?? '업로드에 실패했습니다') : '업로드에 실패했습니다'),
  });
  const applyM = useMutation({
    mutationFn: (uploadId: string) => dataApi.apply(uploadId, { skipErrors: false, applyWarnings: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['data', 'uploads'] }); toast.success('데이터를 반영했습니다'); },
    onError: () => toast.error('반영에 실패했습니다'),
  });

  const todayPeriod = (() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  })();
  const aiDraftM = useMutation({
    mutationFn: () => dataApi.aiDraft({ dataType, period: todayPeriod }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['data', 'uploads'] }); toast.success('AI 초안이 생성됐습니다. 검토 후 반영하세요.'); },
    onError: () => toast.error('AI 초안 생성에 실패했습니다'),
  });

  const submitFile = (file?: File) => { if (file) upload.mutate(file); };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; submitFile(f); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); submitFile(e.dataTransfer.files?.[0]); };

  const history = historyQ.data ?? [];
  const sel = DT[dataType];

  return (
    <>
      {/* 조합 내부 데이터 업로드 */}
      <section className={`${cardCls} mb-3.5`}>
        <div className="mb-3">
          <div className="text-[14.5px] font-bold">분석 원본 데이터 등록</div>
          <div className="text-[12.5px] text-fg-muted mt-0.5">
            공공데이터로 수집되지 않는 <b className="text-fg">조합 내부 원본 데이터</b>를 등록합니다.
            업로드된 데이터는 검증 후 AI 분석·시나리오·리포트 생성의 기반이 됩니다.
            <span className="ml-1 text-fg-muted/70">(xlsx · csv)</span>
          </div>
        </div>

        {/* 데이터 유형 칩 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {DATA_TYPES.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDataType(d.key)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-[12.5px] font-bold border transition-colors',
                dataType === d.key ? 'bg-brand text-white border-brand' : 'bg-white text-fg-soft border-border-soft hover:bg-brand-soft',
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* 드래그&드롭 존 */}
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onPick} className="hidden" />
        <div
          onClick={() => !upload.isPending && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={clsx(
            'rounded-xl border-2 border-dashed px-5 py-8 text-center cursor-pointer transition-colors',
            dragOver ? 'border-brand bg-brand-soft' : 'border-border-strong hover:border-brand hover:bg-brand-soft/40',
            upload.isPending && 'opacity-60 pointer-events-none',
          )}
        >
          <UploadCloud size={28} className="mx-auto text-brand mb-2" />
          <div className="text-[13.5px] font-bold">{upload.isPending ? '업로드 중…' : <>파일을 끌어다 놓거나 <span className="text-brand-deep underline">클릭해서 선택</span></>}</div>
          <div className="text-[12px] text-fg-muted mt-1">선택한 유형: <b className="text-fg">{sel?.label}</b> · 최대 10MB</div>
        </div>

        {/* 선택 유형 안내 + 양식 다운로드 */}
        <div className="flex items-center justify-between gap-3 mt-3 px-3.5 py-2.5 rounded-[10px] bg-bg-soft flex-wrap">
          <div className="text-[12px] text-fg-soft min-w-0">
            <span className="font-bold text-fg">{sel?.label}</span> 필요 컬럼:{' '}
            <span className="text-fg-muted">{sel?.cols.join(' · ')}</span>
          </div>
          <div className="flex items-center gap-2 flex-none">
            {dataType === 'MEMBER_PERFORMANCE' && (
              <button type="button"
                onClick={() => aiDraftM.mutate()}
                disabled={aiDraftM.isPending}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] text-[12.5px] font-semibold hover:bg-[#dbeafe] disabled:opacity-50">
                <Sparkles size={13} /> {aiDraftM.isPending ? 'AI 생성 중…' : 'AI 초안 생성'}
              </button>
            )}
            <button type="button" onClick={() => downloadTemplate(dataType)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border-soft bg-white text-[12.5px] font-semibold hover:bg-bg-soft">
              <Download size={13} /> 양식 다운로드
            </button>
          </div>
        </div>
      </section>

      {/* ── 업로드 이력 ── */}
      <section className="bg-white border border-border-soft rounded-xl overflow-hidden">
        <div className="px-4.5 py-3.5 border-b border-border-soft text-[14.5px] font-bold">업로드 이력</div>
        {historyQ.isLoading && <div className="px-4.5 py-8 text-center text-[13px] text-fg-muted">불러오는 중…</div>}
        {!historyQ.isLoading && history.length === 0 && (
          <div className="px-4.5 py-10 text-center text-[13px] text-fg-muted">아직 업로드한 내부 데이터가 없습니다.</div>
        )}
        {history.map((h) => {
          const st = STATUS[h.status] ?? { label: h.status, pill: 'bg-bg-soft text-fg-soft', icon: FileText };
          return (
            <div key={h.uploadId} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3.5 px-4 py-3.5 border-b border-border-soft last:border-b-0">
              <span className="w-9 h-9 rounded-[9px] bg-bg-soft text-fg-muted grid place-items-center flex-none"><FileText size={16} /></span>
              <div className="min-w-0">
                <div className="font-bold text-[13px] truncate">{h.filename}</div>
                <div className="text-[11.5px] text-fg-muted mt-0.5">
                  {DT[h.contentType]?.label ?? h.contentType} · {fmtSize(h.size)} · {new Date(h.createdAt).toLocaleDateString('ko-KR')}
                </div>
              </div>
              <span className="text-[11.5px] text-fg-muted whitespace-nowrap">
                {h.totalRows}행 {h.errorCount > 0 && <span className="text-danger font-bold">· 오류 {h.errorCount}</span>}
              </span>
              <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold', st.pill)}>
                <st.icon size={11} /> {st.label}
              </span>
              <button
                type="button"
                disabled={!h.valid || h.status === 'APPLIED' || applyM.isPending}
                onClick={() => applyM.mutate(h.uploadId)}
                className="px-2.5 py-1.5 rounded-md bg-brand text-white font-semibold text-[12.5px] hover:bg-brand-deep disabled:opacity-40"
              >
                {h.status === 'APPLIED' ? '반영됨' : '반영'}
              </button>
            </div>
          );
        })}
      </section>
    </>
  );
}
