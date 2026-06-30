'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { cardCls, btnCls, btnPrimaryCls } from '@/components/shared/PageHead';
import { settingsApi } from '@/lib/api/settings';

const FIELDS = [
  { key: 'production' as const, label: '생산성', desc: '단위면적·두수당 생산량 기반', color: '#41AA4D' },
  { key: 'shipping' as const, label: '출하', desc: '권고 대비 적기 출하·적중률', color: '#2563eb' },
  { key: 'revenue' as const, label: '수익성', desc: '매출·비용 효율 기반', color: '#d97706' },
];
// 예시 계산용 샘플 구성요소 점수
const SAMPLE = { production: 82, shipping: 76, revenue: 79 };

export function WeightsPanel() {
  const qc = useQueryClient();
  const [w, setW] = useState<{ production: number; shipping: number; revenue: number } | null>(null);
  const [synced, setSynced] = useState(false);

  const weightsQ = useQuery({
    queryKey: ['settings', 'weights'],
    queryFn: () => settingsApi.getWeights().then((r) => r.data.data),
  });
  // 서버 값으로 1회 초기화 (render 중 동기화)
  if (weightsQ.data && !synced) {
    setSynced(true);
    setW({ production: weightsQ.data.production, shipping: weightsQ.data.shipping, revenue: weightsQ.data.revenue });
  }

  const save = useMutation({
    mutationFn: () => settingsApi.updateWeights(w!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings', 'weights'] }); toast.success('가중치를 저장했습니다'); },
    onError: () => toast.error('가중치 저장에 실패했습니다 (합계 100 확인)'),
  });

  const sum = w ? w.production + w.shipping + w.revenue : 0;
  const valid = sum === 100;

  const sampleScore = w ? Math.round((SAMPLE.production * w.production + SAMPLE.shipping * w.shipping + SAMPLE.revenue * w.revenue) / 100) : 0;

  return (
    <div className="grid grid-cols-[1.25fr_1fr] max-[900px]:grid-cols-1 gap-3 items-start">
    <section className={cardCls}>
      <div className="text-[14.5px] font-bold mb-1">성과 가중치</div>
      <p className="text-[12.5px] text-fg-muted mb-4">조합원 성과율을 계산하는 구성요소별 비중입니다. 합계는 100이어야 합니다.</p>
      {weightsQ.isLoading || !w ? (
        <div className="py-10 text-center text-[13px] text-fg-muted">불러오는 중…</div>
      ) : (
        <>
          <div className="grid gap-5">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <div>
                    <span className="font-bold text-[14px]">{f.label}</span>
                    <span className="text-[12px] text-fg-muted ml-2">{f.desc}</span>
                  </div>
                  <span className="font-extrabold text-brand-deep text-[15px] w-12 text-right">{w[f.key]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={w[f.key]}
                  onChange={(e) => setW((prev) => ({ ...prev!, [f.key]: Number(e.target.value) }))}
                  className="range-slider w-full"
                  style={{ background: `linear-gradient(to right, var(--color-brand) ${w[f.key]}%, #e5e7eb ${w[f.key]}%)` }}
                />
              </div>
            ))}
          </div>

          <div className={clsx('flex items-center justify-between mt-6 pt-4 border-t border-border-soft', !valid && 'text-danger')}>
            <span className="text-[13px] font-bold">합계</span>
            <span className={clsx('text-[18px] font-extrabold', valid ? 'text-group-top' : 'text-danger')}>
              {sum}% {!valid && <span className="text-[12px] font-semibold">(100이어야 저장 가능)</span>}
            </span>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              className={btnCls}
              onClick={() => weightsQ.data && setW({ production: weightsQ.data.production, shipping: weightsQ.data.shipping, revenue: weightsQ.data.revenue })}
            >
              되돌리기
            </button>
            <button type="button" className={btnPrimaryCls} disabled={!valid || save.isPending} onClick={() => save.mutate()}>
              저장
            </button>
          </div>

          {weightsQ.data?.updatedAt && (
            <div className="text-[11.5px] text-fg-muted mt-3 text-right">
              마지막 변경 {new Date(weightsQ.data.updatedAt).toLocaleString('ko-KR')}
            </div>
          )}
        </>
      )}
    </section>

    {/* 우측 — 가중치 구성 시각화 + 예시 계산 */}
    <section className={cardCls}>
      <div className="text-[14.5px] font-bold mb-1">가중치 구성</div>
      <p className="text-[12.5px] text-fg-muted mb-4">각 구성요소가 성과율에 반영되는 비중</p>
      {!w ? (
        <div className="py-10 text-center text-[13px] text-fg-muted">—</div>
      ) : (
        <>
          {/* 누적 막대 */}
          <div className="flex h-6 rounded-lg overflow-hidden border border-border-soft mb-4">
            {FIELDS.map((f) => (
              <div key={f.key} style={{ width: `${w[f.key]}%`, background: f.color }} className="transition-all" title={`${f.label} ${w[f.key]}%`} />
            ))}
          </div>
          {/* 범례 */}
          <div className="grid gap-2.5 mb-5">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-sm flex-none" style={{ background: f.color }} />
                <span className="text-[13px] font-semibold flex-1">{f.label}</span>
                <span className="text-[13px] font-extrabold" style={{ color: f.color }}>{w[f.key]}%</span>
              </div>
            ))}
          </div>

          {/* 예시 계산 */}
          <div className="border-t border-border-soft pt-4">
            <div className="text-[12px] text-fg-muted mb-2.5">예시 — 구성요소 점수가 아래일 때 성과율</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="rounded-[9px] bg-bg-soft px-2.5 py-2 text-center">
                  <div className="text-[10.5px] text-fg-muted">{f.label}</div>
                  <div className="text-[15px] font-extrabold" style={{ color: f.color }}>{SAMPLE[f.key]}</div>
                </div>
              ))}
            </div>
            <div className="rounded-[10px] bg-brand-soft border border-brand/20 px-3.5 py-3 flex items-center justify-between">
              <div className="text-[12px] text-fg-soft leading-snug">
                {SAMPLE.production}×{w.production}% + {SAMPLE.shipping}×{w.shipping}% + {SAMPLE.revenue}×{w.revenue}%
              </div>
              <div className="text-right flex-none pl-3">
                <div className="text-[10.5px] text-fg-muted">성과율</div>
                <div className="text-[22px] font-extrabold text-brand-deep leading-none">{sampleScore}</div>
              </div>
            </div>
            <p className="text-[11.5px] text-fg-muted mt-3">슬라이더를 조정하면 비중·예시 성과율이 즉시 반영됩니다. 비중이 높은 구성요소일수록 성과율에 더 크게 작용합니다.</p>
          </div>
        </>
      )}
    </section>
    </div>
  );
}
