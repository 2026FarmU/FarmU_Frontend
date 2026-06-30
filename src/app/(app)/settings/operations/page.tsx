'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { PageHead } from '@/components/shared/PageHead';
import { RoleGuard } from '@/components/shared/RoleGuard';
import { DataUploadPanel } from '@/components/operations/DataUploadPanel';
import { WeightsPanel } from '@/components/operations/WeightsPanel';

type Tab = 'data' | 'weights';

export default function OperationsPage() {
  const [tab, setTab] = useState<Tab>('data');

  return (
    <RoleGuard allow={['UNION_ADMIN']}>
      <PageHead
        title="운영 설정"
        description="AI 분석의 기반이 되는 조합 내부 원본 데이터를 등록하고, 조합원 성과 산식의 가중치를 관리합니다."
      />

      <div className="flex gap-1 border-b border-border-soft mb-3.5">
        {([['data', '원본 데이터 등록'], ['weights', '성과 가중치']] as Array<[Tab, string]>).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={clsx(
              'px-4 py-2.5 font-bold text-[13.5px] -mb-px border-b-2',
              tab === k ? 'text-brand-deep border-brand' : 'text-fg-muted border-transparent'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'data' ? <DataUploadPanel /> : <WeightsPanel />}
    </RoleGuard>
  );
}
