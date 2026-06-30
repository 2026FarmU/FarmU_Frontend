'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { PageHead, btnCls, btnPrimaryCls, btnDangerCls } from '@/components/shared/PageHead';
import { useAuthStore } from '@/lib/store/authStore';
import { clearTokens } from '@/lib/auth/session';
import { usersApi, type NotificationSetting, type NotificationSettingGroup } from '@/lib/api/users';
import { membersApi } from '@/lib/api/members';
import { scenariosApi } from '@/lib/api/scenarios';
import { reportsApi } from '@/lib/api/reports';
import { shippingApi } from '@/lib/api/shipping';
import { mentoringApi } from '@/lib/api/mentoring';
import { useMe } from '@/lib/hooks/useMe';
import { ComboInput } from '@/components/shared/ComboInput';
import { CROPS, LIVESTOCK } from '@/constants/agriculture';
import { isAxiosError } from 'axios';
import { Edit2, AlertTriangle, Check, ChevronDown } from 'lucide-react';

// 알림 설정 key → 표시 메타 (백엔드는 key/channels/enabled만 줌)
const NOTIF_META: Record<string, { group: string; title: string; desc: string }> = {
  RISK_ALERT: { group: '안전·위험', title: '위험 알림 (HIGH)', desc: '가격 폭락 · 기상 이상 · 수급 충격' },
  SHIPPING_NEW: { group: '안전·위험', title: '출하 권고 새 항목', desc: '신규 출하 추천이 생성된 경우' },
  REPORT_DONE: { group: '리포트·시나리오', title: '리포트 생성 완료', desc: '리포트가 다운로드 가능해진 시점' },
  SCENARIO_DONE: { group: '리포트·시나리오', title: '시나리오 시뮬레이션 완료', desc: '시뮬레이션 결과 도착' },
  MATCH_STATUS: { group: '멘토링', title: '매칭 상태 변경', desc: '요청 / 승인 / 거절 / 종료' },
  MATCH_REQUEST: { group: '멘토링·승인', title: '매칭 승인 요청', desc: '조합원이 멘토링 매칭을 요청한 경우' },
  UPLOAD_VALIDATED: { group: '데이터', title: '데이터 업로드 검증 완료', desc: '업로드 검증이 끝나 반영 대기' },
};
// 문자(SMS)는 제외 — 푸시·이메일만 제공
const CH_OPTIONS = ['PUSH', 'EMAIL'] as const;

const CH_LABEL: Record<string, string> = { PUSH: '푸시', EMAIL: '이메일' };

const GROUP_BADGE: Record<string, { label: string; cls: string }> = {
  TOP: { label: '상위', cls: 'bg-group-top-bg text-group-top' },
  MID: { label: '중위', cls: 'bg-group-mid-bg text-group-mid' },
  LOW: { label: '개선 필요', cls: 'bg-group-low-bg text-group-low' },
};

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-block w-10 h-5.5 flex-none cursor-pointer">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="absolute inset-0 bg-neutral-300 rounded-full transition-colors peer-checked:bg-brand" />
      <span className="absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4.5" />
    </label>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const router = useRouter();
  const isAdmin = user?.role === 'UNION_ADMIN';
  const qc = useQueryClient();

  const profileQ = useQuery({ queryKey: ['users', 'me'], queryFn: () => usersApi.me().then((r) => r.data.data) });
  const p = profileQ.data;
  const joinedLabel = p?.joinedAt ? `가입 ${new Date(p.joinedAt).toLocaleDateString('ko-KR')}` : null;

  // 헤더 통계 — 실데이터 연결 (역할별)
  const { data: me } = useMe();
  const unionId = user?.unionId ?? '';
  const memberId = me?.memberId ?? '';
  const analysisStatQ = useQuery({
    queryKey: ['profile', 'analysis'],
    queryFn: () => membersApi.getAnalysis('me', '2026-05').then((r) => r.data.data),
    enabled: !isAdmin,
  });
  const scenarioStatQ = useQuery({
    queryKey: ['profile', 'scenarios', memberId],
    queryFn: () => scenariosApi.list({ memberId }).then((r) => r.data.data ?? []),
    enabled: !isAdmin && !!memberId,
  });
  const shippingStatQ = useQuery({
    queryKey: ['profile', 'shipping', memberId],
    queryFn: () => shippingApi.getRecommendations({ memberId }).then((r) => r.data.data),
    enabled: !isAdmin && !!memberId,
  });
  const mentoStatQ = useQuery({
    queryKey: ['mentoring', 'stats'],
    queryFn: () => mentoringApi.getStats().then((r) => r.data.data),
  });
  const rankingStatQ = useQuery({
    queryKey: ['profile', 'ranking', unionId],
    queryFn: () => membersApi.getRanking({ unionId, period: '2026-05', size: 200 }).then((r) => r.data),
    enabled: isAdmin && !!unionId,
  });
  const memberList = rankingStatQ.data?.data ?? [];
  // 리포트 목록은 cursorless 페이지({data,page,size,hasNext}) — totalElements 없음 → 길이로 집계
  const reportStatQ = useQuery({
    queryKey: ['profile', 'reports', unionId],
    queryFn: () => reportsApi.getList({ unionId, size: 100 }).then((r) => r.data.data),
    enabled: isAdmin && !!unionId,
  });

  // 리포트 페이지에서 localStorage로 숨김 처리한 ID 목록 (백엔드 삭제 API 없음)
  const [dismissedReportIds, setDismissedReportIds] = useState<string[]>([]);
  useEffect(() => {
    try { setDismissedReportIds(JSON.parse(localStorage.getItem('farmu-dismissed-reports') ?? '[]')); } catch { /* noop */ }
  }, []);

  const ms = mentoStatQ.data;
  const headerStats: Array<[string, string, string]> = isAdmin
    ? [
        ['관리 조합원', rankingStatQ.data ? String(rankingStatQ.data.totalElements) : '—', '명'],
        ['작성한 리포트', reportStatQ.data ? String(reportStatQ.data.filter((r) => !dismissedReportIds.includes(r.reportId)).length) : '—', '건'],
        ['승인한 매칭', ms ? String(ms.active + ms.completed) : '—', '건'],
        ['멘토 가용', ms ? String(ms.availableMentors) : '—', '명'],
      ]
    : [
        ['이번 달 성과율', analysisStatQ.data ? analysisStatQ.data.totalScore.toFixed(1) : '—', '점'],
        ['받은 출하 추천', shippingStatQ.data ? String(shippingStatQ.data.length) : '—', '건'],
        ['생성한 시나리오', scenarioStatQ.data ? String(scenarioStatQ.data.length) : '—', '건'],
        ['멘토링', ms ? String(ms.active) : '—', '건 진행 중'],
      ];

  const [danger, setDanger] = useState<null | { title: string; desc: string; confirm: string; kind: string }>(null);
  const [transferTo, setTransferTo] = useState('');

  // 헤더 액션 모달: 정보 수정 / 조합 전환 / 비밀번호 변경
  const [modal, setModal] = useState<'edit' | 'union' | 'password' | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', bio: '' });
  // 농가 정보 (소속 조합 · 지역 · 주요 작물 · 축산)
  const [farmForm, setFarmForm] = useState({ union: '', region: '', crop: '', livestock: '' });
  // 프로필 로드/변경 시 폼 동기화 (effect 없이 render 중 처리 — React 권장 패턴)
  const [syncedUser, setSyncedUser] = useState<string | null>(null);
  if (p && p.userId !== syncedUser) {
    setSyncedUser(p.userId);
    setForm({ name: p.name ?? '', email: p.email ?? '', phone: p.phone ?? '', bio: p.bio ?? '' });
    setFarmForm({ union: p.unionName ?? '', region: p.region ?? '', crop: p.mainCrop ?? '', livestock: p.livestock ?? '' });
  }
  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setFarm = (k: keyof typeof farmForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFarmForm((f) => ({ ...f, [k]: e.target.value }));
  // 취소·재오픈 시 백엔드 값으로 되돌림 (저장 안 한 입력값이 남지 않게)
  const resetForm = () => {
    setForm({ name: p?.name ?? '', email: p?.email ?? '', phone: p?.phone ?? '', bio: p?.bio ?? '' });
    setFarmForm({ union: p?.unionName ?? '', region: p?.region ?? '', crop: p?.mainCrop ?? '', livestock: p?.livestock ?? '' });
  };
  const openEdit = () => { resetForm(); setModal('edit'); };
  const cancelEdit = () => { resetForm(); setModal(null); };
  const updateProfile = useMutation({
    mutationFn: () => usersApi.updateProfile({
      ...form,
      region: farmForm.region,
      mainCrop: farmForm.crop,
      livestock: farmForm.livestock,
      unionName: farmForm.union,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users', 'me'] }); qc.invalidateQueries({ queryKey: ['profile', 'analysis'] }); setModal(null); toast.success('프로필이 저장되었습니다'); },
    onError: () => toast.error('저장에 실패했습니다'),
  });
  const saveProfile = (e: React.FormEvent) => { e.preventDefault(); updateProfile.mutate(); };

  // 비밀번호 변경
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const changePw = useMutation({
    mutationFn: () => usersApi.changePassword(pw),
    onSuccess: () => { setModal(null); setPw({ currentPassword: '', newPassword: '' }); toast.success('비밀번호를 변경했습니다'); },
    onError: (e) => toast.error(isAxiosError(e) ? ((e.response?.data as { detail?: string } | undefined)?.detail ?? '비밀번호 변경에 실패했습니다') : '비밀번호 변경에 실패했습니다'),
  });

  // 알림 설정
  const settingsQ = useQuery({
    queryKey: ['users', 'notif-settings'],
    queryFn: () => usersApi.getNotificationSettings().then((r) =>
      (r.data.data ?? []).flatMap((g: NotificationSettingGroup) =>
        g.items.map((item) => ({ key: item.key, channels: item.channels, enabled: item.enabled }))
      )
    ),
  });
  const updateSettings = useMutation({
    mutationFn: (next: NotificationSetting[]) => usersApi.updateNotificationSettings(next),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users', 'notif-settings'] }),
    onError: () => toast.error('알림 설정 저장에 실패했습니다'),
  });
  const toggleSetting = (key: string, patch: Partial<NotificationSetting>) => {
    const next = (settingsQ.data ?? []).map((s) => (s.key === key ? { ...s, ...patch } : s))
      // 문자(SMS) 채널은 제외 — 저장 시 항상 제거
      .map((s) => ({ ...s, channels: s.channels.filter((c) => c !== 'SMS') }));
    updateSettings.mutate(next);
  };

  // 배너 이미지 변경 (PATCH /users/me/images, multipart)
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [profileImg, setProfileImg] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://farmu.gbsw.hs.kr';
  // 백엔드가 상대경로로 반환하는 경우 절대 URL로 보정
  const toAbsUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const uploadBanner = useMutation({
    mutationFn: (file: File) => usersApi.uploadBannerImage(file),
    onSuccess: (res) => {
      const url = toAbsUrl(res.data.data.bannerUrl);
      setBanner((prev) => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return url; });
      qc.invalidateQueries({ queryKey: ['users', 'me'] });
      toast.success('배너 이미지를 변경했습니다');
    },
    onError: () => toast.error('이미지 업로드에 실패했습니다'),
  });
  const uploadProfile = useMutation({
    mutationFn: (file: File) => usersApi.uploadProfileImage(file),
    onSuccess: (res) => {
      const url = toAbsUrl(res.data.data.avatarUrl);
      setProfileImg((prev) => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return url; });
      qc.invalidateQueries({ queryKey: ['users', 'me'] });
      toast.success('프로필 사진을 변경했습니다');
    },
    onError: () => toast.error('이미지 업로드에 실패했습니다'),
  });

  const onBannerPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('이미지 파일만 업로드할 수 있습니다'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('5MB 이하 이미지만 가능합니다'); return; }
    setBanner((prev) => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    uploadBanner.mutate(file);
  };
  const onProfilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('이미지 파일만 업로드할 수 있습니다'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('5MB 이하 이미지만 가능합니다'); return; }
    setProfileImg((prev) => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    uploadProfile.mutate(file);
  };
  const bannerGradient = isAdmin
    ? 'radial-gradient(circle at 18% 24%, rgba(255,255,255,0.20), transparent 45%), radial-gradient(circle at 78% 70%, rgba(166,232,190,0.18), transparent 50%), linear-gradient(135deg, #41AA4D 0%, #41AA4D 55%, #1a2a1d 100%)'
    : 'radial-gradient(circle at 18% 24%, rgba(255,255,255,0.20), transparent 45%), radial-gradient(circle at 78% 70%, rgba(191,219,254,0.30), transparent 50%), linear-gradient(135deg, #2563eb 0%, #1d4ed8 55%, #1d4ed8 100%)';

  const onDanger = (nm: string) => {
    if (nm === '비밀번호 변경') { setModal('password'); return; }
    if (nm === '전체 기기 로그아웃')
      setDanger({ title: '전체 기기에서 로그아웃', desc: '발급된 모든 토큰이 폐기되고 모든 기기에서 로그아웃됩니다.', confirm: '로그아웃', kind: 'logout' });
    else if (nm === '권한 이양')
      setDanger({ title: '운영 책임자 권한 이양', desc: '선택한 조합원에게 권한을 이양합니다. 이양 후 본인은 일반 조합원으로 전환됩니다.', confirm: '이양', kind: 'transfer' });
    else if (nm === '계정 비활성화')
      setDanger({ title: '계정 비활성화', desc: '로그인이 불가능해지며 30일 후 영구 삭제됩니다.', confirm: '비활성화', kind: 'deactivate' });
  };

  const runDanger = () => {
    const kind = danger?.kind;
    setDanger(null);
    if (kind === 'logout' || kind === 'deactivate') {
      clearTokens();
      clearAuth();
      toast.success(kind === 'logout' ? '모든 기기에서 로그아웃했습니다' : '계정이 비활성화되었습니다');
      router.push('/login');
    } else if (kind === 'transfer') {
      toast.success(`${transferTo}에게 운영 책임자 권한을 이양했습니다`);
    }
  };

  return (
    <>
      <PageHead
        title="프로필"
        description={
          isAdmin
            ? '운영 책임자 계정 정보와 권한, 알림 설정을 관리합니다.'
            : '내 계정 정보, 알림 받는 방법, 비밀번호 같은 설정을 관리합니다.'
        }
      />

      {/* Hero */}
      <section className="bg-white border border-border-soft rounded-2xl mb-3">
        <div
          className="relative h-50 bg-center bg-cover"
          style={(banner ?? toAbsUrl(p?.bannerUrl)) ? { backgroundImage: `url(${banner ?? toAbsUrl(p?.bannerUrl)})` } : { background: bannerGradient }}
        >
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={onBannerPick}
            className="hidden"
          />
          <button type="button" onClick={() => bannerInputRef.current?.click()} className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/92 backdrop-blur text-fg text-xs font-bold hover:bg-white">
            <Edit2 size={13} /> 배너 변경
          </button>
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] max-[820px]:grid-cols-1 gap-5.5 items-end px-6.5 pb-5.5">
          <div className="relative z-10" style={{ transform: 'translateY(-30px)' }}>
            <div
              onClick={() => profileInputRef.current?.click()}
              className={clsx(
                'relative w-30 h-30 rounded-full grid place-items-center font-extrabold text-[38px] -tracking-wider border-4 border-white overflow-hidden cursor-pointer group/avatar',
                isAdmin ? 'bg-admin-soft text-admin' : 'bg-brand-soft text-brand-deep'
              )}
            >
              {(profileImg ?? toAbsUrl(p?.avatarUrl)) ? (
                <img src={profileImg ?? toAbsUrl(p?.avatarUrl) ?? ''} alt="프로필" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <span>{isAdmin ? '김' : '조1'}</span>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover/avatar:bg-black/40 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover/avatar:opacity-100 transition-opacity text-white text-[12px] font-semibold">
                  {uploadProfile.isPending ? '업로드 중…' : '변경'}
                </span>
              </div>
            </div>
            <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={onProfilePick} />
          </div>

          <div className="pb-3 min-w-0">
            <div className="text-[22px] font-extrabold tracking-tight flex items-center gap-2.5 flex-wrap">
              {p?.name ?? user?.name ?? (isAdmin ? '운영 책임자' : '조합원')}
              {isAdmin ? (
                <span className="px-2.5 py-0.5 rounded-full bg-admin text-white text-[11px] font-extrabold">운영 책임자</span>
              ) : (
                <span className={clsx('px-2.5 py-0.5 rounded-full text-[11px] font-bold', GROUP_BADGE[analysisStatQ.data?.group ?? 'MID'].cls)}>
                  ● {GROUP_BADGE[analysisStatQ.data?.group ?? 'MID'].label}
                </span>
              )}
            </div>
            <div className="text-[13px] text-fg-muted mt-1.5 flex items-center gap-1.5 flex-wrap">
              {(isAdmin
                ? ['운영 책임자', p?.unionName, p?.region, p?.email].filter(Boolean)
                : ['조합원', p?.unionName, p?.region ?? analysisStatQ.data?.region, p?.email].filter(Boolean)
              ).map((t, i, arr) => (
                <span key={t as string}>
                  {t}
                  {i < arr.length - 1 && <span className="ml-1.5 text-border-strong">·</span>}
                </span>
              ))}
            </div>
            <div className="flex gap-1.5 mt-2.5 flex-wrap">
              {(isAdmin
                ? [
                    rankingStatQ.data ? `조합원 ${rankingStatQ.data.totalElements}명 관리` : '조합원 관리',
                    '컨설턴트 역할 겸임',
                    p?.mainCrop ? `${p.mainCrop} 재배` : null,
                    p?.livestock && p.livestock !== '없음' ? `축산 ${p.livestock}` : null,
                    joinedLabel,
                  ]
                : [(p?.mainCrop ?? analysisStatQ.data?.crop) ? `${p?.mainCrop ?? analysisStatQ.data?.crop} 재배` : null, p?.livestock ? `축산 ${p.livestock}` : null, typeof p?.landCount === 'number' ? `필지 ${p.landCount}개` : null, joinedLabel]
              ).filter(Boolean).map((t) => (
                <span key={t} className="inline-flex items-center px-2.5 py-1 rounded-full bg-bg-soft border border-border-soft text-[11.5px] text-fg-soft font-semibold">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pb-1">
            {isAdmin && (
              <button type="button" className={btnCls} onClick={() => setModal('union')}>조합 전환</button>
            )}
            <button type="button" className={btnPrimaryCls} onClick={openEdit}>정보 수정</button>
          </div>
        </div>

        <div className="grid grid-cols-4 max-[820px]:grid-cols-2 border-t border-border-soft">
          {headerStats.map(([k, v, unit], i, arr) => (
            <div
              key={k}
              className={clsx('px-5.5 py-3.5 border-r border-border-soft', i === arr.length - 1 && 'border-r-0')}
            >
              <div className="text-[11px] text-fg-muted font-bold tracking-wider uppercase">{k}</div>
              <div className="text-lg font-extrabold tracking-tight mt-1">
                {v}<small className="text-xs text-fg-muted font-semibold ml-0.5">{unit}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 알림 설정 */}
      <div className="text-[14.5px] font-bold mb-2.5 mt-1">알림 설정</div>
      {settingsQ.isLoading && (
        <div className="bg-white border border-border-soft rounded-[10px] px-4 py-6 text-center text-[13px] text-fg-muted mb-2.5">불러오는 중…</div>
      )}
      {Object.entries(
        (settingsQ.data ?? []).reduce<Record<string, NotificationSetting[]>>((acc, sett) => {
          const grp = NOTIF_META[sett.key]?.group ?? '기타';
          (acc[grp] ??= []).push(sett);
          return acc;
        }, {})
      ).map(([grp, items]) => (
        <div key={grp} className="bg-[#FFFFFF] border border-border-soft rounded-[10px] overflow-hidden mb-2.5">
          <div className="px-4 py-3 bg-[#FFFFFF] border-b border-border-soft text-xs font-bold text-fg-soft tracking-wider uppercase">
            {grp}
          </div>
          {items.map((it) => {
            const meta = NOTIF_META[it.key];
            return (
              <div key={it.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3.5 px-4 py-3.5 border-b border-border-soft last:border-b-0 max-md:grid-cols-1 bg-[#FFFFFF]">
                <div>
                  <div className="font-bold text-[13.5px]">{meta?.title ?? it.key}</div>
                  {meta?.desc && <div className="text-xs text-fg-muted mt-0.5">{meta.desc}</div>}
                </div>
                <div className="flex gap-1.5 text-[11.5px] text-fg-muted">
                  {CH_OPTIONS.map((ch) => {
                    const checked = it.channels.includes(ch);
                    return (
                      <label key={ch} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-soft cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSetting(it.key, { channels: checked ? it.channels.filter((c) => c !== ch) : [...it.channels, ch] })}
                          className="peer sr-only"
                        />
                        <span className="w-4 h-4 rounded grid place-items-center border border-border-strong bg-white peer-checked:bg-brand peer-checked:border-brand transition-colors">
                          <Check size={11} strokeWidth={3} className="text-white" />
                        </span>
                        {CH_LABEL[ch] ?? ch}
                      </label>
                    );
                  })}
                </div>
                <Switch on={it.enabled} onChange={(v) => toggleSetting(it.key, { enabled: v })} />
              </div>
            );
          })}
        </div>
      ))}

      {/* 위험 구역 */}
      <div className="bg-white border border-[#f4c2c2] rounded-xl overflow-hidden mt-3.5">
        <div className="bg-[#fef2f2] px-4.5 py-3.5 border-b border-[#f4c2c2] flex items-center gap-2.5">
          <AlertTriangle size={20} className="text-danger" />
          <div>
            <div className="font-extrabold text-danger text-sm">위험 구역</div>
            <div className="text-xs text-[#8a3a3a] mt-0.5">
              아래 작업은 되돌릴 수 없거나 {isAdmin && '조합 전체에 영향을 줍니다'}{!isAdmin && '계정에 영향을 줍니다'}. 신중히 진행하세요.
            </div>
          </div>
        </div>
        {(isAdmin
          ? [
              ['비밀번호 변경', '현재 비밀번호 확인 후 새 비밀번호로 변경합니다.', '변경하기', false],
              ['전체 기기 로그아웃', '현재 발급된 모든 토큰을 폐기합니다.', '로그아웃', true],
              ['권한 이양', '다른 조합원에게 운영 책임자 권한을 이양합니다. 이양 후 본인 권한은 일반 조합원으로 전환됩니다.', '권한 이양', true],
            ]
          : [
              ['비밀번호 변경', '현재 비밀번호 확인 후 새 비밀번호로 변경합니다.', '변경하기', false],
              ['전체 기기 로그아웃', '현재 발급된 모든 토큰을 폐기하고 모든 기기에서 로그아웃합니다.', '로그아웃', true],
              ['계정 비활성화', '계정을 비활성화하면 로그인이 불가능해지며, 30일 후 영구 삭제됩니다.', '계정 비활성화', true],
            ]
        ).map(([nm, ds, btn, danger]: any) => (
          <div key={nm} className="grid grid-cols-[1fr_auto] items-center gap-3.5 px-4.5 py-4 border-b border-border-soft last:border-b-0">
            <div>
              <div className="font-bold text-[13.5px]">{nm}</div>
              <div className="text-xs text-fg-muted mt-0.5">{ds}</div>
            </div>
            <button type="button" onClick={() => onDanger(nm as string)} className={danger ? btnDangerCls : btnCls}>{btn}</button>
          </div>
        ))}
      </div>

      {/* 정보 수정 모달 */}
      {modal === 'edit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <form
            onSubmit={saveProfile}
            className="bg-white rounded-2xl border border-border-soft w-[440px] max-w-full max-h-[85vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-9 h-9 rounded-full bg-brand-soft text-brand-deep grid place-items-center"><Edit2 size={16} /></span>
              <div className="text-[16px] font-extrabold">정보 수정</div>
            </div>
            <div className="text-[12.5px] text-fg-muted mb-4">변경 후 저장을 누르면 적용됩니다.</div>

            <div className="grid grid-cols-2 max-[480px]:grid-cols-1 gap-3">
              {([
                ['이름', 'name'], ['이메일', 'email'],
              ] as Array<[string, 'name' | 'email']>).map(([label, key]) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-fg-soft mb-1.5">{label}</label>
                  <input
                    value={form[key]}
                    onChange={setF(key)}
                    className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft"
                  />
                </div>
              ))}
              <div className="col-span-2 max-[480px]:col-span-1">
                <label className="block text-xs font-bold text-fg-soft mb-1.5">전화번호</label>
                <input
                  value={form.phone}
                  onChange={setF('phone')}
                  className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft"
                />
              </div>
              <div className="col-span-2 max-[480px]:col-span-1">
                <label className="block text-xs font-bold text-fg-soft mb-1.5">한 줄 소개 {isAdmin ? '(조합원에게 노출)' : '(선택)'}</label>
                <input
                  value={form.bio}
                  onChange={setF('bio')}
                  placeholder={isAdmin ? '예: 합천농업법인회사 운영 11년차, 사과·배 컨설팅 전문' : '예: 합천에서 사과 농사 12년차입니다'}
                  className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft"
                />
              </div>
            </div>

            {/* 농가 정보 — 소속 조합 · 지역 · 주요 작물 · 축산 */}
            <div className="mt-4 pt-4 border-t border-border-soft">
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="text-[13px] font-extrabold">농가 정보</span>
                <span className="text-[11px] text-fg-muted">소속 조합 · 지역 · 주요 작물 · 축산</span>
              </div>
              <div className="grid grid-cols-2 max-[480px]:grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-bold text-fg-soft mb-1.5">소속 조합</label>
                  <input
                    value={farmForm.union}
                    onChange={setFarm('union')}
                    placeholder="예: 합천농업법인회사"
                    className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-fg-soft mb-1.5">지역</label>
                  <input
                    value={farmForm.region}
                    onChange={setFarm('region')}
                    placeholder="예: 경북 의성군 봉양면"
                    className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-fg-soft mb-1.5">주요 작물</label>
                  <ComboInput value={farmForm.crop} onChange={(v) => setFarmForm((f) => ({ ...f, crop: v }))} options={CROPS} placeholder="목록에서 선택 또는 직접 입력 (예: 사과, 배)" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-fg-soft mb-1.5">축산</label>
                  <ComboInput value={farmForm.livestock} onChange={(v) => setFarmForm((f) => ({ ...f, livestock: v }))} options={LIVESTOCK} placeholder="목록에서 선택 또는 직접 입력 (예: 한우 20두 / 없음)" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className={btnCls} onClick={cancelEdit}>취소</button>
              <button type="submit" className={btnPrimaryCls} disabled={updateProfile.isPending}>{updateProfile.isPending ? '저장 중…' : '저장'}</button>
            </div>
          </form>
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {modal === 'password' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" onClick={() => setModal(null)}>
          <form
            onSubmit={(e) => { e.preventDefault(); if (pw.currentPassword && pw.newPassword) changePw.mutate(); }}
            className="bg-white rounded-2xl border border-border-soft w-[400px] max-w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[16px] font-extrabold mb-1">비밀번호 변경</div>
            <div className="text-[12.5px] text-fg-muted mb-4">현재 비밀번호 확인 후 새 비밀번호로 변경합니다.</div>
            <div className="grid gap-3">
              <input
                type="password"
                value={pw.currentPassword}
                onChange={(e) => setPw((v) => ({ ...v, currentPassword: e.target.value }))}
                placeholder="현재 비밀번호"
                required
                className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft"
              />
              <input
                type="password"
                value={pw.newPassword}
                onChange={(e) => setPw((v) => ({ ...v, newPassword: e.target.value }))}
                placeholder="새 비밀번호"
                required
                className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft"
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className={btnCls} onClick={() => setModal(null)}>취소</button>
              <button type="submit" disabled={changePw.isPending} className={btnPrimaryCls}>변경</button>
            </div>
          </form>
        </div>
      )}

      {/* 조합 전환 모달 (운영 책임자) */}
      {modal === 'union' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl border border-border-soft w-[400px] max-w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-[16px] font-extrabold mb-1">조합 전환</div>
            <div className="text-[12.5px] text-fg-muted mb-4">관리할 조합을 선택합니다.</div>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => { setModal(null); toast.success(`${p?.unionName ?? '내 조합'}으로 전환했습니다`); }}
                className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] border border-brand bg-brand-soft text-left"
              >
                <span className="w-9 h-9 rounded-full bg-admin-soft text-admin grid place-items-center font-extrabold text-[13px] flex-none">{(p?.unionName ?? '내').slice(0, 1)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13.5px]">{p?.unionName ?? '내 조합'}</div>
                  <div className="text-[11.5px] text-fg-muted">
                    {(typeof window !== 'undefined' ? localStorage.getItem('activeUnionCode') : null) ?? 'DEMO'} · 조합원 {rankingStatQ.data?.totalElements ?? memberList.length}명
                  </div>
                </div>
                <Check size={16} className="text-brand-deep flex-none" />
              </button>

              <div className="px-3.5 py-4 rounded-[10px] border border-dashed border-border-soft text-center text-[12.5px] text-fg-muted">
                연결된 다른 조합이 없습니다.<br />다른 조합에 소속되면 여기서 전환할 수 있어요.
              </div>
            </div>

            <div className="flex justify-end mt-5">
              <button type="button" className={btnCls} onClick={() => setModal(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 위험 작업 확인 모달 */}
      {danger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={() => setDanger(null)}>
          <div className="bg-white rounded-2xl border border-border-soft w-[360px] max-w-[calc(100vw-2rem)] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-full bg-danger-bg text-danger grid place-items-center mb-4">
              <AlertTriangle size={20} />
            </div>
            <div className="text-[16px] font-extrabold mb-1.5">{danger.title}</div>
            <div className="text-[13px] text-fg-muted leading-relaxed mb-4">{danger.desc}</div>
            {danger.kind === 'transfer' && (
              <div className="relative w-full mb-4">
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="appearance-none w-full pl-3 pr-9 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] cursor-pointer"
                >
                  {memberList.length === 0 && <option value="">이양할 조합원이 없습니다</option>}
                  {memberList.map((m) => (
                    <option key={m.memberId} value={m.name}>{m.name}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted" />
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setDanger(null)} className="flex-1 py-2.5 rounded-[10px] border border-border-soft bg-white text-fg font-bold text-[14px] hover:bg-bg-soft">취소</button>
              <button type="button" onClick={runDanger} className="flex-1 py-2.5 rounded-[10px] bg-danger text-white font-bold text-[14px] hover:opacity-90">{danger.confirm}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
