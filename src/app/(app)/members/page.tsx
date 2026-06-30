'use client';

import { toast } from 'sonner';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import clsx from 'clsx';
import { PageHead, btnCls, btnSmCls, btnPrimaryCls, chipCls, chipOnCls } from '@/components/shared/PageHead';
import { RoleGuard } from '@/components/shared/RoleGuard';
import { membersApi } from '@/lib/api/members';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/authStore';
import { X, Download, UserPlus, ChevronDown } from 'lucide-react';

type Group = 'top' | 'mid' | 'low';
interface Member {
  rank: number; name: string; uid: string; init: string; group: Group; score: number;
  delta: number; bars: [number, number, number]; crop: string; region: string;
}

const GROUP_CHIP: Record<Group, string> = {
  top: 'bg-group-top-bg text-group-top',
  mid: 'bg-group-mid-bg text-group-mid',
  low: 'bg-group-low-bg text-group-low',
};
const GROUP_LABEL: Record<Group, string> = { top: '상위', mid: '중위', low: '개선 필요' };

export default function MembersPage() {
  const router = useRouter();
  const unionId = useAuthStore((s) => s.user?.unionId) ?? '';
  const [selected, setSelected] = useState<Member | null>(null);
  const [grp, setGrp] = useState<'all' | Group>('all');
  const [crop, setCrop] = useState('전체');
  const [region, setRegion] = useState('전체');
  const [sort, setSort] = useState('점수순');

  const qc = useQueryClient();
  const rankingQ = useQuery({
    queryKey: ['members', 'ranking', unionId],
    queryFn: () =>
      membersApi.getRanking({ unionId, period: '2026-05', size: 200 }).then((r) => r.data.data),
    enabled: !!unionId,
  });

  // 조합원 계정 발급 (auth/register)
  const [regOpen, setRegOpen] = useState(false);
  const [reg, setReg] = useState({ name: '', loginId: '', password: '' });
  const register = useMutation({
    mutationFn: () => {
      const unionCode = typeof window !== 'undefined' ? localStorage.getItem('activeUnionCode') ?? '' : '';
      return authApi.register({ ...reg, unionCode });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', 'ranking', unionId] });
      setRegOpen(false);
      setReg({ name: '', loginId: '', password: '' });
      toast.success('조합원 계정을 발급했습니다');
    },
    onError: (e) => toast.error(isAxiosError(e) ? ((e.response?.data as { detail?: string } | undefined)?.detail ?? '계정 발급에 실패했습니다') : '계정 발급에 실패했습니다'),
  });

  const members: Member[] = (rankingQ.data ?? []).map((m) => ({
    rank: m.rank,
    name: m.name,
    uid: m.memberId,
    init: m.name.slice(0, 1),
    group: m.group.toLowerCase() as Group,
    score: m.score,
    delta: m.scoreDelta,
    bars: [m.components.production, m.components.shipping, m.components.revenue],
    crop: m.mainCrop,
    region: m.region,
  }));

  // 필터 옵션은 실제 조합원 데이터에서 추출 (하드코딩 X)
  // 경축: 복수경축("사과, 배")은 개별 분리 / 지역: 데이터의 고유값 그대로
  const cropOptions = Array.from(
    new Set(members.flatMap((m) => (m.crop ?? '').split(/[,/·]/).map((c) => c.trim())).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, 'ko'));
  const regionOptions = Array.from(new Set(members.map((m) => m.region).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'ko'),
  );

  const filtered = members
    .filter((m) => grp === 'all' || m.group === grp)
    .filter((m) => crop === '전체' || m.crop.includes(crop))
    .filter((m) => region === '전체' || m.region === region)
    .slice()
    .sort((a, b) =>
      sort === '변화량순' ? b.delta - a.delta
        : sort === '이름순' ? a.name.localeCompare(b.name)
          : b.score - a.score);

  // CSV 내보내기 (현재 필터·정렬 결과 기준)
  const exportCsv = () => {
    if (filtered.length === 0) { toast.error('내보낼 조합원이 없습니다'); return; }
    const headers = ['순위', '이름', '조합원ID', '그룹', '점수', '전월대비', '생산성', '출하', '수익성', '주요경축', '지역'];
    const esc = (v: string | number) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filtered.map((m) => [
      m.rank, m.name, m.uid, GROUP_LABEL[m.group], m.score, m.delta,
      m.bars[0], m.bars[1], m.bars[2], m.crop, m.region,
    ]);
    const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
    // BOM 추가 — Excel에서 한글 깨짐 방지
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `조합원목록_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`조합원 ${filtered.length}명 CSV를 내보냈습니다`);
  };

  // 클라이언트 페이지네이션
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, pageCount);
  const paged = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const pageStart = filtered.length === 0 ? 0 : (curPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(curPage * PAGE_SIZE, filtered.length);
  const pageNums = buildPageNums(curPage, pageCount);

  return (
    <RoleGuard allow={['UNION_ADMIN']}>
      <PageHead
        title="조합원 목록"
        description="조합원 성과·그룹·경축·지역별로 비교하고 분석합니다."
        right={
          <>
            <button type="button" className={btnCls} onClick={exportCsv}>
              <Download size={14} /> CSV 다운로드
            </button>
            <button type="button" className={btnPrimaryCls} onClick={() => setRegOpen(true)}>
              <UserPlus size={14} /> 조합원 추가
            </button>
          </>
        }
      />

      {/* 조합원 계정 발급 모달 */}
      {regOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" onClick={() => setRegOpen(false)}>
          <form
            onSubmit={(e) => { e.preventDefault(); if (reg.name && reg.loginId && reg.password) register.mutate(); }}
            className="bg-white rounded-2xl border border-border-soft w-[400px] max-w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[16px] font-extrabold mb-1">조합원 계정 발급</div>
            <div className="text-[12.5px] text-fg-muted mb-4">새 조합원 로그인 계정을 만듭니다. 역할은 조합원(MEMBER)으로 생성됩니다.</div>
            <div className="grid gap-3">
              {([['이름', 'name', 'text', '조합원 이름'], ['아이디', 'loginId', 'text', '로그인 아이디'], ['초기 비밀번호', 'password', 'text', '초기 비밀번호']] as Array<[string, 'name' | 'loginId' | 'password', string, string]>).map(([label, key, type, ph]) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-fg-soft mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={reg[key]}
                    onChange={(e) => setReg((v) => ({ ...v, [key]: e.target.value }))}
                    placeholder={ph}
                    required
                    autoComplete="off"
                    className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className={btnCls} onClick={() => setRegOpen(false)}>취소</button>
              <button type="submit" disabled={register.isPending} className={btnPrimaryCls}>발급</button>
            </div>
          </form>
        </div>
      )}

      {/* 정보 바 */}
      <div className="bg-white border border-border-soft border-l-4 rounded-xl px-4.5 py-3 mb-3.5 flex items-center gap-4 flex-wrap" style={{ borderLeftColor: '#41AA4D' }}>
        <span className="text-[11px] text-fg-muted font-bold tracking-wider uppercase">조합원 현황</span>
        <div className="flex gap-5.5 ml-auto flex-wrap items-center">
          {([
            ['전체 조합원', `${members.length}명`],
            ['조회 결과', `${filtered.length}명`],
          ] as Array<[string, string]>).map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 items-center text-center">
              <span className="text-[10.5px] text-fg-muted font-bold tracking-wider uppercase">{k}</span>
              <span className="text-lg font-extrabold tracking-tight text-fg">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 필터 바 */}
      <div className="bg-white border border-border-soft rounded-xl p-3 mb-3.5 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-fg-muted">그룹</span>
        {([['all', '전체'], ['top', '상위'], ['mid', '중위'], ['low', '개선 필요']] as const).map(([g, label]) => (
          <button key={g} type="button" onClick={() => setGrp(g)} className={grp === g ? chipOnCls : chipCls}>{label}</button>
        ))}
        <span className="w-px h-4.5 bg-border-soft mx-1" />
        <span className="text-xs font-bold text-fg-muted">경축</span>
        <div className="relative">
          <select value={crop} onChange={(e) => setCrop(e.target.value)} className="appearance-none pl-2.5 pr-7 py-1.5 rounded-md border border-border-soft text-xs bg-white cursor-pointer">
            <option value="전체">전체</option>
            {cropOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-fg-muted" />
        </div>
        <span className="w-px h-4.5 bg-border-soft mx-1" />
        <span className="text-xs font-bold text-fg-muted">지역</span>
        <div className="relative">
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="appearance-none pl-2.5 pr-7 py-1.5 rounded-md border border-border-soft text-xs bg-white cursor-pointer">
            <option value="전체">전체</option>
            {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-fg-muted" />
        </div>
        <span className="w-px h-4.5 bg-border-soft mx-1" />
        <span className="text-xs font-bold text-fg-muted">정렬</span>
        <div className="relative">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="appearance-none pl-2.5 pr-7 py-1.5 rounded-md border border-border-soft text-xs bg-white cursor-pointer">
            <option>점수순</option><option>변화량순</option><option>이름순</option>
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-fg-muted" />
        </div>
        <div className="flex-1" />
        <span className="text-xs font-bold text-fg">검색 결과 {filtered.length}명</span>
      </div>

      {/* 본문 */}
      <div
        className={clsx(
          'grid gap-3 transition-all',
          selected ? 'grid-cols-[1fr_340px] max-[1180px]:grid-cols-1' : 'grid-cols-1'
        )}
      >
        {/* 테이블 */}
        <section className="bg-white border border-border-soft rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {['순위', '이름', '그룹', '점수 ▾', '변화량', '구성요소 (생산·출하·수익)', '주요 경축', '지역'].map((h, i) => (
                    <th
                      key={i}
                      className={clsx(
                        'text-left font-bold text-fg-muted text-[11px] tracking-wider uppercase',
                        'px-2.5 py-3 border-b border-border-soft bg-bg-soft sticky top-0 z-[1]',
                        i === 3 && 'text-brand-deep cursor-pointer'
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(rankingQ.isLoading || filtered.length === 0) && (
                  <tr>
                    <td colSpan={8} className="px-2.5 py-10 text-center text-[13px] text-fg-muted">
                      {rankingQ.isLoading ? '불러오는 중…' : rankingQ.isError ? '목록을 불러오지 못했습니다.' : '조건에 맞는 조합원이 없습니다.'}
                    </td>
                  </tr>
                )}
                {paged.map((m) => {
                  const isSelected = selected?.uid === m.uid;
                  return (
                    <tr
                      key={m.uid}
                      onClick={() => setSelected(m)}
                      className={clsx(
                        'cursor-pointer border-b border-border-soft',
                        isSelected ? 'bg-brand-soft' : 'hover:bg-bg-soft'
                      )}
                    >
                      <td className={clsx('px-2.5 py-3 font-extrabold w-9', m.rank <= 3 ? 'text-brand-deep' : 'text-fg-muted')}>
                        {m.rank}
                      </td>
                      <td className="px-2.5 py-3 min-w-35">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7.5 h-7.5 rounded-full bg-brand-soft text-brand-deep grid place-items-center font-extrabold text-[11.5px] flex-none">{m.init}</span>
                          <div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); router.push(`/members/${m.uid}`); }}
                              className="font-bold text-left hover:text-brand-deep hover:underline underline-offset-2"
                            >
                              {m.name}
                            </button>
                            <div className="text-[11px] text-fg-muted mt-px">{m.uid}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2.5 py-3">
                        <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-[11px] font-extrabold', GROUP_CHIP[m.group])}>
                          ● {GROUP_LABEL[m.group]}
                        </span>
                      </td>
                      <td className="px-2.5 py-3 font-extrabold text-[15px] tracking-tight">{m.score}</td>
                      <td className={clsx('px-2.5 py-3 font-bold text-[12.5px]', m.delta >= 0 ? 'text-group-top' : 'text-group-low')}>
                        {m.delta >= 0 ? '▲' : '▼'} {Math.abs(m.delta)}
                      </td>
                      <td className="px-2.5 py-3">
                        <div className="text-[10.5px] text-fg-muted mb-1">{m.bars.join(' · ')}</div>
                        <div className="flex gap-1 min-w-30">
                          {m.bars.map((b, i) => (
                            <div key={i} className="flex-1 h-1.25 bg-bg-soft rounded-full relative overflow-hidden">
                              <div
                                className="absolute top-0 bottom-0 left-0 rounded-full"
                                style={{
                                  width: `${b}%`,
                                  background: i === 0 ? '#41AA4D' : i === 1 ? '#339940' : '#6db5a4',
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-2.5 py-3">{m.crop}</td>
                      <td className="px-2.5 py-3">{m.region}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션: 좌 빈공간 / 중앙 버튼 / 우 정보 */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3.5 border-t border-border-soft">
            <div />
            <div className="flex gap-1 justify-center col-start-2">
              {pageCount > 1 && (
                <>
                  <button type="button" disabled={curPage === 1} onClick={() => setPage(curPage - 1)} className="w-7.5 h-7.5 rounded-md border border-border-soft bg-white text-fg hover:bg-bg-soft disabled:opacity-40 text-[13px]">‹</button>
                  {pageNums.map((p, i) =>
                    p === '…' ? (
                      <span key={`e${i}`} className="w-7.5 h-7.5 grid place-items-center text-[13px] text-fg-muted">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={clsx('w-7.5 h-7.5 rounded-md border text-[13px]', p === curPage ? 'bg-brand text-white border-brand' : 'bg-white border-border-soft text-fg hover:bg-bg-soft')}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button type="button" disabled={curPage === pageCount} onClick={() => setPage(curPage + 1)} className="w-7.5 h-7.5 rounded-md border border-border-soft bg-white text-fg hover:bg-bg-soft disabled:opacity-40 text-[13px]">›</button>
                </>
              )}
            </div>
            <div className="text-[12.5px] text-fg-muted justify-self-end col-start-3">{pageStart} ~ {pageEnd} of {filtered.length}</div>
          </div>
        </section>

        {/* 우측 미니 패널 */}
        {selected && (
          <aside className="bg-white border border-border-soft rounded-xl self-start sticky top-[88px] overflow-hidden">
            <div className="flex justify-between items-center px-4.5 py-4 border-b border-border-soft">
              <div className="font-extrabold text-sm">선택된 조합원</div>
              <button
                onClick={() => setSelected(null)}
                className="w-7 h-7 rounded-md border border-border-soft bg-white text-fg-muted hover:bg-bg-soft"
              >
                <X size={14} className="mx-auto" />
              </button>
            </div>
            <div className="px-4.5 py-4.5">
              <div className="w-16 h-16 rounded-full bg-brand-soft text-brand-deep grid place-items-center font-extrabold text-[22px] mx-auto mb-3">
                {selected.init}
              </div>
              <div className="text-center font-extrabold text-base">{selected.name}</div>
              <div className="text-center text-xs text-fg-muted mt-0.5">{selected.uid} · 합천농업법인회사 · {selected.region}</div>

              <div className="grid grid-cols-2 gap-2.5 my-4.5">
                <div className="bg-bg-soft rounded-lg p-2.5 text-center">
                  <div className="text-[11px] text-fg-muted font-semibold">총 성과율</div>
                  <div className="text-base font-extrabold mt-1">{selected.score}</div>
                </div>
                <div className="bg-bg-soft rounded-lg p-2.5 text-center">
                  <div className="text-[11px] text-fg-muted font-semibold">전월 대비</div>
                  <div className={clsx('text-base font-extrabold mt-1', selected.delta >= 0 ? 'text-group-top' : 'text-group-low')}>
                    {selected.delta >= 0 ? '+' : ''}{selected.delta}
                  </div>
                </div>
              </div>

              <div className="pt-3.5 mt-3.5 border-t border-border-soft">
                <div className="text-[11px] text-fg-muted font-bold tracking-wider uppercase mb-2">구성요소</div>
                <div className="grid gap-2">
                  {['생산성', '출하', '수익성'].map((label, i) => (
                    <div key={label} className="flex justify-between text-[12.5px]">
                      <span>{label}</span><b>{selected.bars[i]}</b>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3.5 mt-3.5 border-t border-border-soft">
                <div className="text-[11px] text-fg-muted font-bold tracking-wider uppercase mb-2">기본 정보</div>
                <div className="text-[12.5px] text-fg-soft leading-7">
                  주요 경축 · {selected.crop}<br />
                  지역 · {selected.region}
                </div>
              </div>
            </div>

            <div className="flex gap-1.5 px-4.5 py-3.5 border-t border-border-soft">
<button type="button" className={`${btnPrimaryCls} flex-1 justify-center`} onClick={() => router.push(`/members/${selected.uid}`)}>상세 분석 →</button>
            </div>
          </aside>
        )}
      </div>
    </RoleGuard>
  );
}

// 페이지 번호 + 말줄임(…) 생성
function buildPageNums(cur: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | '…'> = [1];
  const start = Math.max(2, cur - 1);
  const end = Math.min(total - 1, cur + 1);
  if (start > 2) out.push('…');
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push('…');
  out.push(total);
  return out;
}
