'use client';

// 인쇄용 리포트 뷰 — 백엔드 리포트 PDF가 스텁(68바이트)이라, 실제 API 데이터로 채운
// 리포트를 그려 브라우저 인쇄(window.print)로 "PDF로 저장"하게 한다. (app) 그룹 밖이라 사이드바 없음.

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { dashboardApi } from '@/lib/api/dashboard';
import { membersApi } from '@/lib/api/members';
import { reportsApi } from '@/lib/api/reports';

const GROUP_LABEL: Record<string, string> = { TOP: '상위', MID: '중위', LOW: '개선 필요', top: '상위', mid: '중위', low: '개선 필요' };
const krw = (n?: number | null) => (typeof n === 'number' ? `${Math.round(n).toLocaleString()}원` : '—');
const pct = (n?: number | null) => (typeof n === 'number' ? `${n}%` : '—');

// 아주 가벼운 마크다운 렌더 (## 제목 · **굵게** · - 목록 · 문단)
function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>);
  return (
    <div className="md">
      {lines.map((ln, i) => {
        const t = ln.trim();
        if (!t) return <div key={i} className="h-2" />;
        if (t.startsWith('### ')) return <h3 key={i}>{bold(t.slice(4))}</h3>;
        if (t.startsWith('## ')) return <h2 key={i}>{bold(t.slice(3))}</h2>;
        if (t.startsWith('# ')) return <h2 key={i}>{bold(t.slice(2))}</h2>;
        if (/^[-*]\s/.test(t)) return <div key={i} className="ml-3 flex gap-1.5"><span className="text-brand-deep">•</span><span>{bold(t.replace(/^[-*]\s/, ''))}</span></div>;
        if (/^\d+\.\s/.test(t)) return <div key={i} className="ml-1">{bold(t)}</div>;
        return <p key={i}>{bold(t)}</p>;
      })}
    </div>
  );
}

function ReportBody() {
  const sp = useSearchParams();
  const type = sp.get('type') ?? 'MONTHLY';
  const period = sp.get('period') ?? '';
  const unionId = sp.get('unionId') ?? '';
  const unionName = sp.get('unionName') || unionId || '우리조합';
  const reportId = sp.get('id') ?? '';
  const isMember = type === 'MEMBER';

  // AI-2: 리포트 LLM 본문(content) — id가 있을 때만
  const detailQ = useQuery({
    queryKey: ['rp', 'detail', reportId],
    queryFn: () => reportsApi.getStatus(reportId).then((r) => r.data.data),
    enabled: !!reportId,
  });
  const aiContent = detailQ.data?.content;

  const summaryQ = useQuery({
    queryKey: ['rp', 'summary', unionId, period],
    queryFn: () => dashboardApi.getSummary({ unionId, period }).then((r) => r.data.data),
    enabled: !!unionId && !!period,
  });
  const rankingQ = useQuery({
    queryKey: ['rp', 'ranking', unionId, period],
    queryFn: () => membersApi.getRanking({ unionId, period, size: 200 }).then((r) => r.data.data),
    enabled: !!unionId && !!period,
  });

  const s = summaryQ.data;
  const members = rankingQ.data ?? [];
  const gd = s?.groupDistribution ?? { top: 0, mid: 0, low: 0 };
  const total = gd.top + gd.mid + gd.low || 1;
  // 생성 시각은 마운트 후 설정 — SSR/클라 시간차 하이드레이션 불일치 방지
  const [now, setNow] = useState('');
  useEffect(() => { setNow(new Date().toLocaleString('ko-KR')); }, []);
  const loading = summaryQ.isLoading || rankingQ.isLoading;

  const KPI: Array<[string, string]> = [
    ['평균 성과율', s ? `${s.avgScore}${typeof s.scoreDelta === 'number' ? ` (전월 ${s.scoreDelta >= 0 ? '+' : ''}${s.scoreDelta})` : ''}` : '—'],
    ['출하 적중률', s ? pct(s.kpi.shippingHitRate) : '—'],
    ['평균 수익', s ? krw(s.kpi.avgRevenue) : '—'],
    ['조합원 수', s ? `${s.memberCount}명` : '—'],
  ];

  return (
    <div className="report">
      {/* 인쇄 시 숨기는 툴바 */}
      <div className="toolbar no-print">
        <div>
          <strong>{unionName}</strong> · {period} {type === 'MEMBER' ? '액션플랜' : type === 'UNION' ? '조합 리포트' : '조합 월간 리포트'}
        </div>
        <button onClick={() => window.print()} className="printbtn">
          <Printer size={15} /> PDF로 저장 / 인쇄
        </button>
      </div>

      <article className="page">
        <header className="rhead">
          <div className="brand">팜유 <span>FarmU</span></div>
          <h1>{type === 'MEMBER' ? '조합원 액션플랜' : '조합 월간 운영 리포트'}</h1>
          <div className="meta">
            <span>{unionName}</span><span>대상 기간 {period}</span><span>생성 {now}</span>
            {detailQ.data?.model && <span>AI {detailQ.data.model}</span>}
          </div>
        </header>

        {/* AI-2: LLM 자연어 본문 (id로 열었을 때) */}
        {reportId && (
          <section>
            <h2>AI 분석 요약</h2>
            {detailQ.isLoading ? (
              <p className="muted">AI 리포트를 불러오는 중…</p>
            ) : aiContent ? (
              <div className="aibody"><Markdown text={aiContent} /></div>
            ) : (
              <p className="muted">AI 생성 본문이 없습니다.</p>
            )}
          </section>
        )}

        {loading ? (
          <p className="muted">데이터를 불러오는 중…</p>
        ) : !s ? (
          <p className="muted">해당 기간({period})의 데이터가 없습니다.</p>
        ) : (
          <>
            <section>
              <h2>운영 요약</h2>
              <div className="kpis">
                {KPI.map(([k, v]) => (
                  <div className="kpi" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
                ))}
              </div>
            </section>

            <section>
              <h2>성과 그룹 분포</h2>
              <table className="bars">
                <tbody>
                  {([['상위', gd.top, '#16a34a'], ['중위', gd.mid, '#d97706'], ['개선 필요', gd.low, '#dc2626']] as Array<[string, number, string]>).map(([label, n, c]) => (
                    <tr key={label}>
                      <td className="bl">{label}</td>
                      <td className="bw"><div className="bar" style={{ width: `${Math.round((n / total) * 100)}%`, background: c }} /></td>
                      <td className="bn">{n}명 ({Math.round((n / total) * 100)}%)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {!isMember && (
              <section>
                <h2>조합원 성과 순위</h2>
                <table className="rank">
                  <thead>
                    <tr><th>순위</th><th>조합원</th><th>그룹</th><th>지역</th><th>주요 경축</th><th>성과율</th><th>전월</th></tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.memberId}>
                        <td>{m.rank}</td><td>{m.name}</td>
                        <td>{GROUP_LABEL[m.group] ?? m.group}</td>
                        <td>{m.region}</td><td>{m.mainCrop}</td>
                        <td className="num">{m.score}</td>
                        <td className="num">{typeof m.scoreDelta === 'number' ? `${m.scoreDelta >= 0 ? '+' : ''}${m.scoreDelta}` : '—'}</td>
                      </tr>
                    ))}
                    {members.length === 0 && <tr><td colSpan={7} className="muted">조합원 데이터 없음</td></tr>}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}

        <footer className="rfoot">팜유(FarmU) · 농협 조합원 성과관리 AI 플랫폼 · 본 리포트는 {now} 기준 데이터로 생성되었습니다.</footer>
      </article>

      <style>{`
        .report { background: #f3f4f6; min-height: 100vh; }
        .toolbar { position: sticky; top: 0; display: flex; justify-content: space-between; align-items: center;
          gap: 16px; padding: 12px 20px; background: #fff; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
        .printbtn { display: inline-flex; align-items: center; gap: 7px; background: #2c7a4b; color: #fff;
          border: none; padding: 9px 16px; border-radius: 9px; font-weight: 700; font-size: 13.5px; cursor: pointer; }
        .printbtn:hover { background: #246340; }
        .page { background: #fff; max-width: 800px; margin: 22px auto; padding: 40px 44px; box-shadow: 0 6px 24px rgba(0,0,0,.08);
          color: #1a1d1a; font-size: 13px; line-height: 1.55; }
        .rhead { border-bottom: 2px solid #2c7a4b; padding-bottom: 16px; margin-bottom: 22px; }
        .brand { font-weight: 800; color: #2c7a4b; font-size: 18px; letter-spacing: -.02em; }
        .brand span { font-size: 12px; color: #6b7280; font-weight: 700; }
        .rhead h1 { font-size: 24px; font-weight: 800; margin: 8px 0 10px; }
        .rhead .meta { display: flex; gap: 18px; color: #6b7280; font-size: 12px; }
        section { margin: 22px 0; }
        h2 { font-size: 15px; font-weight: 800; margin: 0 0 12px; padding-left: 9px; border-left: 4px solid #2c7a4b; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .kpi { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; }
        .kpi .k { font-size: 11px; color: #6b7280; font-weight: 700; }
        .kpi .v { font-size: 17px; font-weight: 800; margin-top: 4px; }
        .bars { width: 100%; border-collapse: collapse; }
        .bars td { padding: 5px 0; vertical-align: middle; }
        .bars .bl { width: 80px; font-weight: 700; }
        .bars .bw { width: auto; }
        .bars .bar { height: 16px; border-radius: 4px; min-width: 2px; }
        .bars .bn { width: 110px; text-align: right; color: #4b5563; font-weight: 600; }
        .big { font-size: 26px; font-weight: 800; color: #2c7a4b; margin: 0; }
        .big .muted { font-size: 12px; font-weight: 600; }
        .muted { color: #9ca3af; }
        table.rank { width: 100%; border-collapse: collapse; font-size: 12px; }
        table.rank th, table.rank td { border-bottom: 1px solid #eceae3; padding: 7px 8px; text-align: left; }
        table.rank th { background: #f7f6f2; font-weight: 700; color: #4b5563; }
        table.rank .num { text-align: right; font-weight: 700; }
        .aibody { font-size: 13px; line-height: 1.7; color: #2a2d2a; }
        .aibody h2 { font-size: 15px; font-weight: 800; margin: 14px 0 6px; padding: 0; border: 0; }
        .aibody h3 { font-size: 13.5px; font-weight: 800; margin: 10px 0 4px; }
        .aibody p { margin: 3px 0; }
        .rfoot { margin-top: 30px; padding-top: 14px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; }
        @media print {
          .report { background: #fff; }
          .no-print { display: none !important; }
          .page { box-shadow: none; margin: 0; max-width: none; padding: 0; }
          @page { size: A4; margin: 16mm; }
          section { break-inside: avoid; }
          table.rank tr { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

export default function ReportPrintPage() {
  return (
    <Suspense fallback={null}>
      <ReportBody />
    </Suspense>
  );
}
