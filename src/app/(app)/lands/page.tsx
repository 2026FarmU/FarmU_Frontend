'use client';

import { toast } from 'sonner';
import { useEffect, useRef, useState, useCallback } from 'react';
import Script from 'next/script';
import { useSearchParams, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { X, AlertTriangle, Sparkles, MapPinPlus, Trash2, ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useAuthStore } from '@/lib/store/authStore';
import { membersApi } from '@/lib/api/members';
import { landsApi } from '@/lib/api/lands';
import { ComboInput } from '@/components/shared/ComboInput';
import { KYEONGCHUK, LIVESTOCK } from '@/constants/agriculture';
import { useMe } from '@/lib/hooks/useMe';

// 폴리곤(위경도 링) 면적(m²) — 등거리 근사(위도 보정 shoelace)
function ringAreaM2(ring: Array<{ lat: number; lng: number }>): number {
  if (ring.length < 3) return 0;
  const R = 6378137;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat0 = toRad(ring.reduce((s, p) => s + p.lat, 0) / ring.length);
  const pts = ring.map((p) => ({ x: toRad(p.lng) * Math.cos(lat0) * R, y: toRad(p.lat) * R }));
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
  }
  return Math.abs(a / 2);
}

interface PickedParcel {
  pnu: string;
  jibun: string;
  addr: string;
  lat: number;
  lng: number;
  areaM2: number;
}

declare global {
  interface Window { naver: any; navermap_authFailure?: () => void; }
}

interface LandFeature {
  type: string;
  geometry: { type: string; coordinates: number[][][] };
  properties: {
    landId: string; pnu: string; areaHa: number; currentCrop: string;
    suitabilityScore: number; memberId: string; landName: string;
    soil: string; slope: number; altitude: number; address?: string;
  };
}

function scoreToColor(score: number) {
  if (score >= 80) return 'rgba(65,170,77,0.55)';
  if (score >= 60) return 'rgba(217,119,6,0.50)';
  return 'rgba(220,38,38,0.45)';
}
function scoreToBorderColor(score: number) {
  if (score >= 80) return '#339940';
  if (score >= 60) return '#a16207';
  return '#b91c1c';
}

// 조합원별 식별 색상 팔레트 (fill rgba + border hex)
const MEMBER_PALETTE: Array<{ fill: string; border: string }> = [
  { fill: 'rgba(59,130,246,0.55)',  border: '#1d4ed8' }, // 파랑
  { fill: 'rgba(168,85,247,0.55)',  border: '#7e22ce' }, // 보라
  { fill: 'rgba(234,88,12,0.55)',   border: '#c2410c' }, // 주황
  { fill: 'rgba(236,72,153,0.55)', border: '#be185d' }, // 핑크
  { fill: 'rgba(20,184,166,0.55)', border: '#0f766e' }, // 청록
  { fill: 'rgba(234,179,8,0.55)',  border: '#a16207' }, // 노랑
  { fill: 'rgba(239,68,68,0.55)',  border: '#b91c1c' }, // 빨강
  { fill: 'rgba(16,185,129,0.55)', border: '#047857' }, // 에메랄드
];
const memberColorCache = new Map<string, { fill: string; border: string }>();
function getMemberColor(memberId: string): { fill: string; border: string } {
  if (!memberColorCache.has(memberId)) {
    memberColorCache.set(memberId, MEMBER_PALETTE[memberColorCache.size % MEMBER_PALETTE.length]);
  }
  return memberColorCache.get(memberId)!;
}

const CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID ?? '';
const VWORLD_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY ?? '';
const CADASTRAL_MIN_ZOOM = 16; // 지번 표시 최소 줌

// 지목(地目) 분류 — 농경지 위주로 색상 부여
interface JimokStyle { label: string; color: string; agri: boolean; emphasis?: boolean }
const JIMOK_STYLE: Record<string, JimokStyle> = {
  // 경작지
  '전': { label: '전(밭)',     color: '#a3e635', agri: true },
  '답': { label: '답(논)',     color: '#38bdf8', agri: true },
  '과': { label: '과수원',     color: '#fb923c', agri: true },
  '임': { label: '임야(산)',   color: '#15803d', agri: true },
  // 축산·시설 (축사가 위치하는 지목 — 강조)
  '목': { label: '목장용지(축사)', color: '#e11d48', agri: true, emphasis: true },
  '잡': { label: '목장(잡종지)', color: '#e11d48', agri: true, emphasis: true },
  '창': { label: '창고용지',   color: '#e11d48', agri: true, emphasis: true },
};
const JIMOK_DEFAULT: JimokStyle = { label: '기타', color: '#94a3b8', agri: false };
// 지번에서 지목 글자 추출 (예: "107전"→"전", "산108임"→"임", "55 장"→"장")
function getJimok(jibun?: string): string {
  if (!jibun) return '';
  const m = jibun.match(/[가-힣]$/);
  return m ? m[0] : '';
}
// 범례 — 경작지 / 축산·시설 구분
const CROP_JIMOK = ['전', '답', '과', '임'] as const;
const LIVESTOCK_JIMOK = ['목', '잡', '창'] as const;

// 팜맵(실제 경작 분류) 색상 — intprNm 기준
const FARMMAP_STYLE: Record<string, { label: string; color: string; emphasis?: boolean }> = {
  '논':   { label: '논',                color: '#38bdf8' },
  '밭':   { label: '밭',                color: '#a3e635' },
  '과수': { label: '과수원',            color: '#fb923c' },
  '시설': { label: '시설(하우스·스마트팜)', color: '#a855f7', emphasis: true },
};
const FARMMAP_CATS = ['논', '밭', '과수', '시설'] as const;
function normIntpr(s?: string): string {
  if (!s) return '';
  if (s.includes('논')) return '논';
  if (s.includes('밭')) return '밭';
  if (s.includes('과')) return '과수';
  if (s.includes('시설')) return '시설';
  if (s.includes('인삼')) return '밭';
  return '';
}

export default function LandsPage() {
  const user = useAuthStore((s) => s.user);
  const { data: me } = useMe();
  const isAdmin = user?.role === 'UNION_ADMIN';
  const router = useRouter();

  // 실제 조합원 목록 (운영책임자 필지 필터용)
  const membersQ = useQuery({
    queryKey: ['members', 'ranking', user?.unionId ?? ''],
    queryFn: () => membersApi.getRanking({ unionId: user?.unionId ?? '', period: '2026-05', size: 200 }).then((r) => r.data.data),
    enabled: isAdmin && !!user?.unionId,
  });
  const members = membersQ.data ?? [];
  const memberName = (id: string) => members.find((m) => m.memberId === id)?.name ?? id;

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const polygons = useRef<any[]>([]);
  const landMarkers = useRef<any[]>([]); // 등록 필지 라벨 핀 (어느 줌에서든 보이게)
  const parcelOverlays = useRef<any[]>([]); // 지적도(WFS) 필지·지번
  const cadIdle = useRef<any>(null);
  const lastBox = useRef<{ minLat: number; minLng: number; maxLat: number; maxLng: number; zoom: number } | null>(null);
  const cadTimer = useRef<any>(null);
  const searchMarker = useRef<any>(null);
  const lastQuery = useRef<string>('');

  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [features, setFeatures] = useState<LandFeature[]>([]);
  const [selected, setSelected] = useState<LandFeature | null>(null);
  const [aiCands, setAiCands] = useState<Array<{ rank: number; name: string; score: number; revenue: string; risk: number; current?: boolean; reasons: string[] }>>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [aiFactors, setAiFactors] = useState<{ soil: number; climate: number; slope: number; sunlight: number } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [listOpen, setListOpen] = useState(true); // 필지 목록 패널 접기/펴기
  // 서버에서 삭제 못하는 필지(시드 의존성 500 등)는 화면에서만 숨김
  const hiddenRef = useRef<string[]>([]);
  useEffect(() => {
    try { hiddenRef.current = JSON.parse(localStorage.getItem('farmu-hidden-lands') ?? '[]'); } catch { /* noop */ }
  }, []);
  const hideLand = (id: string) => {
    const next = [...new Set([...hiddenRef.current, id])];
    hiddenRef.current = next;
    if (typeof window !== 'undefined') localStorage.setItem('farmu-hidden-lands', JSON.stringify(next));
    setFeatures((prev) => prev.filter((f) => f.properties.landId !== id));
    setSelected((s) => (s?.properties.landId === id ? null : s));
  };
  const [loading, setLoading] = useState(true);
  const [mapMode, setMapMode] = useState<'satellite' | 'normal' | 'cadastral' | 'farmmap'>('farmmap');
  const [cadHint, setCadHint] = useState('');
  const [searchInfo, setSearchInfo] = useState<{ addr: string; found: boolean } | null>(null);
  const searchParams = useSearchParams();
  const queryParam = searchParams.get('q');
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const labelParam = searchParams.get('label');

  // ── 필지 직접 등록 ──────────────────────────────────────────────
  const qc = useQueryClient();
  const [activeMemberId, setActiveMemberId] = useState<string>('default'); // 운영책임자 선택 조합원
  const [registerMode, setRegisterMode] = useState(false);
  const registerModeRef = useRef(false);
  useEffect(() => { registerModeRef.current = registerMode; }, [registerMode]);
  const focusNext = useRef<{ lat: number; lng: number } | null>(null); // 등록 직후 새 필지로 지도 포커스
  const [picked, setPicked] = useState<PickedParcel | null>(null);
  const [regForm, setRegForm] = useState({ name: '', crop: '', headCount: null as number | null });

  const createLand = useMutation({
    mutationFn: () => {
      if (!picked) throw new Error('no parcel');
      const memberId = isAdmin ? activeMemberId : me?.memberId;
      return landsApi.create({
        name: regForm.name.trim() || picked.jibun || '내 필지',
        pnu: picked.pnu,
        address: picked.addr,
        latitude: picked.lat,
        longitude: picked.lng,
        area: Math.round(picked.areaM2),
        mainCrop: regForm.crop.trim(),
        ...(regForm.headCount !== null ? { headCount: regForm.headCount } : {}),
        ...(isAdmin && memberId && memberId !== 'default' ? { memberId } : {}),
      });
    },
    onSuccess: () => {
      toast.success('필지를 등록했습니다');
      if (picked) focusNext.current = { lat: picked.lat, lng: picked.lng }; // 새 필지로 지도 포커스
      setPicked(null); setRegForm({ name: '', crop: '', headCount: null }); setRegisterMode(false);
      fetchLands(isAdmin ? activeMemberId : (me?.memberId ?? 'default'));
      qc.invalidateQueries({ queryKey: ['lands'] });
    },
    onError: () => {
      toast.error('필지 등록에 실패했습니다');
    },
  });

  const deleteLand = useMutation({
    mutationFn: (landId: string) => landsApi.remove(landId),
    onSuccess: (_d, landId) => {
      hideLand(landId);
      toast.success('필지를 삭제했습니다');
      fetchLands(isAdmin ? activeMemberId : (me?.memberId ?? 'default'));
      qc.invalidateQueries({ queryKey: ['lands'] });
    },
    onError: (_err, landId) => {
      // 서버 삭제 불가(시드 의존성 500 등) → 화면에서만 숨김 처리
      hideLand(landId);
      toast('화면에서 숨겼습니다 (서버에서 삭제할 수 없는 필지)');
    },
  });

  // 팜맵 데이터 fetch
  const fetchLands = useCallback(async (memberId: string) => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('accessToken') ?? '') : '';
      const res = await fetch(`/api/lands?memberId=${memberId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const geojson = await res.json();
      setFeatures((geojson.features ?? []).filter((f: LandFeature) => !hiddenRef.current.includes(f.properties.landId)));
    } catch (err) {
      console.error('[Lands]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 운영책임자는 전체(default). 조합원은 본인 memberId가 확정된 뒤에만 조회
    // (userId는 memberId와 달라 잘못된 빈 조회가 나가므로 me 로딩 전엔 대기)
    if (isAdmin) fetchLands('default');
    else if (me?.memberId) fetchLands(me.memberId);
  }, [fetchLands, me, isAdmin]);

  // 진입 즉시: 등록된 필지 좌표만 빠르게 받아 지도를 그 위치로 이동(폴리곤 로드 전에)
  useEffect(() => {
    if (!sdkLoaded || !mapInstance.current) return;
    if (latParam || lngParam || queryParam) return; // 주소 검색 중이면 스킵
    const mid = isAdmin ? (activeMemberId !== 'default' ? activeMemberId : undefined) : me?.memberId;
    if (!isAdmin && !mid) return; // 조합원은 me 로딩 후
    let cancelled = false;
    landsApi.getByMember(mid).then((r) => {
      const naver = window.naver;
      if (cancelled || !mapInstance.current || !naver) return;
      const ls = (r.data.data ?? []).filter((l) =>
        l.latitude >= 33 && l.latitude <= 39 && l.longitude >= 124 && l.longitude <= 132 &&
        !hiddenRef.current.includes(l.landId)
      );
      if (ls.length === 0) return;
      if (ls.length === 1) {
        mapInstance.current.setCenter(new naver.maps.LatLng(ls[0].latitude, ls[0].longitude));
        mapInstance.current.setZoom(17);
      } else {
        const b = new naver.maps.LatLngBounds(new naver.maps.LatLng(ls[0].latitude, ls[0].longitude), new naver.maps.LatLng(ls[0].latitude, ls[0].longitude));
        ls.forEach((l) => b.extend(new naver.maps.LatLng(l.latitude, l.longitude)));
        mapInstance.current.fitBounds(b, { top: 80, bottom: 80, left: 80, right: 80 });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sdkLoaded, isAdmin, me, activeMemberId, latParam, lngParam, queryParam]);

  // 지도 1회 생성 (SDK·컨테이너 준비 시)
  const initMap = useCallback(() => {
    if (mapInstance.current) return;
    const naver = window.naver;
    const el = mapRef.current;
    if (!el || !naver?.maps) return;
    try {
      mapInstance.current = new naver.maps.Map(el, {
        center: new naver.maps.LatLng(35.5603, 128.1655),
        zoom: 14,
        mapTypeId: naver.maps.MapTypeId.HYBRID, // 위성 + 지명/행정구역 라벨
        logoControl: false,
        mapDataControl: false,
        scaleControl: true,
      });
      setSdkLoaded(true);
      // 레이아웃 확정 후 1회 재측정
      requestAnimationFrame(() => {
        if (mapInstance.current) naver.maps.Event.trigger(mapInstance.current, 'resize');
      });
    } catch (err: any) {
      setMapError(`지도 생성 오류: ${err?.message}`);
    }
  }, []);

  // SDK 준비될 때까지 가볍게 폴링 (onReady 누락 대비)
  useEffect(() => {
    if (sdkLoaded) return;
    const id = setInterval(() => {
      if (window.naver?.maps && mapRef.current) {
        initMap();
        clearInterval(id);
      }
    }, 120);
    return () => clearInterval(id);
  }, [sdkLoaded, initMap]);

  // 인증 실패 핸들러 등록
  useEffect(() => {
    window.navermap_authFailure = () => {
      setMapError(
        `네이버 지도 인증 실패 (navermap_authFailure)\n` +
        `ncpKeyId: "${CLIENT_ID}"\n\n` +
        `원인은 둘 중 하나입니다:\n` +
        `① 이 키가 console.ncloud.com의 Maps 키가 아님\n` +
        `   (developers.naver.com 키는 지도에 사용 불가)\n` +
        `② Maps 앱에 http://localhost:3000 이 등록되지 않음`
      );
    };
    return () => { delete window.navermap_authFailure; };
  }, [initMap]);

  // features → 폴리곤 렌더링
  useEffect(() => {
    if (!sdkLoaded || !mapInstance.current || features.length === 0) return;
    const naver = window.naver;

    polygons.current.forEach((p) => p.setMap(null));
    polygons.current = [];
    landMarkers.current.forEach((m) => m.setMap(null));
    landMarkers.current = [];

    const bounds = new naver.maps.LatLngBounds(
      new naver.maps.LatLng(90, 180),
      new naver.maps.LatLng(-90, -180)
    );

    features.forEach((f) => {
      const paths = f.geometry.coordinates[0].map(([lng, lat]) => {
        const ll = new naver.maps.LatLng(lat, lng);
        bounds.extend(ll);
        return ll;
      });

      // 운영책임자: 조합원별 색상 / 조합원 본인: 메인 파란색
      const memberClr = isAdmin && f.properties.memberId
        ? getMemberColor(f.properties.memberId)
        : { fill: 'rgba(37,99,235,0.50)', border: '#1d4ed8' };
      const fillColor   = memberClr.fill;
      const borderColor = memberClr.border;

      const poly = new naver.maps.Polygon({
        map: mapInstance.current,
        paths,
        fillColor,
        fillOpacity: 0.6,
        strokeColor: borderColor,
        strokeWeight: 2,
        strokeOpacity: 0.9,
        clickable: true,
      });

      naver.maps.Event.addListener(poly, 'click', () => setSelected(f));
      polygons.current.push(poly);

      // 라벨 핀 — 줌이 축소돼 폴리곤이 작아져도 필지가 보이게 (중심에 이름·적합도)
      const ring = f.geometry.coordinates[0];
      const cLng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      const cLat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
      const col = borderColor;
      const marker = new naver.maps.Marker({
        map: mapInstance.current,
        position: new naver.maps.LatLng(cLat, cLng),
        icon: {
          content:
            `<div style="transform:translate(-50%,-120%);display:flex;align-items:center;gap:4px;` +
            `background:#fff;border:2px solid ${col};border-radius:999px;padding:1px 7px 1px 2px;` +
            `box-shadow:0 2px 6px rgba(0,0,0,.3);white-space:nowrap;font-family:inherit;cursor:pointer">` +
            `<span style="display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;` +
            `background:${col};color:#fff;font-size:9.5px;font-weight:800">${f.properties.suitabilityScore}</span>` +
            `<span style="font-size:11px;font-weight:800;color:#1a1d1a;max-width:90px;overflow:hidden;text-overflow:ellipsis">${f.properties.landName}</span>` +
            `</div>`,
          anchor: new naver.maps.Point(0, 0),
        },
      });
      naver.maps.Event.addListener(marker, 'click', () => setSelected(f));
      landMarkers.current.push(marker);
    });

    // 방금 등록한 필지가 있으면 그 위치로 포커스(폴리곤이 바로 보이게)
    if (focusNext.current) {
      mapInstance.current.setCenter(new naver.maps.LatLng(focusNext.current.lat, focusNext.current.lng));
      mapInstance.current.setZoom(18);
      focusNext.current = null;
    } else if (!registerMode) {
      // 등록 모드에선 fitBounds로 축소하지 않음(필지 고를 수 있게 확대 유지)
      // 주소 검색이 활성화된 상태면 fitBounds가 검색 위치를 덮어쓰지 않도록 건너뜀
      const searchActive = !!(latParam || lngParam || queryParam);
      if (features.length > 0 && !searchActive) {
        mapInstance.current.fitBounds(bounds, { top: 80, bottom: 80, left: 80, right: selected ? 420 : 80 });
      }
    }
  }, [sdkLoaded, features, selected, registerMode, latParam, lngParam, queryParam]);

  // 지적도(WFS) 오버레이 제거
  const clearParcels = useCallback(() => {
    parcelOverlays.current.forEach((o) => {
      if (o.setMap) o.setMap(null);
      else if (o.close) o.close();
    });
    parcelOverlays.current = [];
    lastBox.current = null;
  }, []);

  // 현재 화면 영역의 연속지적도(필지 도형 + 지번) 로드
  const loadParcels = useCallback(async () => {
    const naver = window.naver;
    const map = mapInstance.current;
    if (!naver?.maps || !map) return;
    if (map.getZoom() < CADASTRAL_MIN_ZOOM) {
      clearParcels();
      setCadHint('확대하면 필지 경계·지번이 표시됩니다 (줌 16 이상)');
      return;
    }
    setCadHint('지적 데이터 불러오는 중…');
    const b = map.getBounds();
    const sw = b.getSW ? b.getSW() : b.getMin();
    const ne = b.getNE ? b.getNE() : b.getMax();
    // 고줌(화면이 한 필지보다 작을 때) WFS 빈 결과 방지 — 최소 ~250m 영역으로 패딩
    let minLat = sw.lat(), minLng = sw.lng(), maxLat = ne.lat(), maxLng = ne.lng();
    const MIN_SPAN = 0.0025;
    const cLat = (minLat + maxLat) / 2, cLng = (minLng + maxLng) / 2;
    if (maxLat - minLat < MIN_SPAN) { minLat = cLat - MIN_SPAN / 2; maxLat = cLat + MIN_SPAN / 2; }
    if (maxLng - minLng < MIN_SPAN) { minLng = cLng - MIN_SPAN / 2; maxLng = cLng + MIN_SPAN / 2; }
    const zoom = map.getZoom();

    // 이미 그려둔 범위 안에서 살짝 움직인 경우 재로드 스킵 (부하 최소화)
    const lb = lastBox.current;
    if (lb && lb.zoom === zoom &&
        minLat >= lb.minLat && maxLat <= lb.maxLat &&
        minLng >= lb.minLng && maxLng <= lb.maxLng) {
      return;
    }

    // 조회 영역을 양옆으로 30% 여유 패딩 → 작은 팬마다 재조회 안 하도록
    const padLat = (maxLat - minLat) * 0.3, padLng = (maxLng - minLng) * 0.3;
    minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng;
    const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
    try {
      const res = await fetch(`/api/cadastral?bbox=${bbox}`);
      const geo = await res.json();

      // 팜맵 모드: 실제 경작 분류(PNU→intprNm) 추가 조회
      let fmClass: Map<string, { intprNm: string; vdptYr: string }> | null = null;
      if (mapMode === 'farmmap') {
        const dLatM = (maxLat - minLat) * 111000;
        const dLngM = (maxLng - minLng) * 111000 * Math.cos((cLat * Math.PI) / 180);
        const radM = Math.min(1000, Math.round(Math.sqrt(dLatM * dLatM + dLngM * dLngM) / 2) + 80);
        try {
          const fr = await fetch(`/api/farmmap?lat=${cLat}&lng=${cLng}&radius=${radM}`);
          const fm = await fr.json();
          fmClass = new Map();
          for (const fp of fm.parcels ?? []) {
            if (fp.pnu) fmClass.set(String(fp.pnu), { intprNm: fp.intprNm, vdptYr: fp.vdptYr });
          }
        } catch { fmClass = new Map(); }
      }

      clearParcels();
      lastBox.current = { minLat, minLng, maxLat, maxLng, zoom };
      const feats: any[] = geo.features ?? [];
      const MAX_PARCELS = 120;            // 농경지 최대 렌더 수 (성능)
      const MAX_LABELS = 50;              // 지번 라벨 최대 수 (마커가 무거움)
      const showLabels = zoom >= 18;      // 지번은 충분히 확대했을 때만
      let drawn = 0;
      let labeled = 0;
      let skippedAgri = 0;

      for (const f of feats) {
        let st: { label: string; color: string; emphasis?: boolean } | undefined;
        let fmYear = '';
        if (mapMode === 'farmmap') {
          const fmEntry = fmClass?.get(String(f.properties?.pnu ?? ''));
          if (fmEntry) {
            st = FARMMAP_STYLE[normIntpr(fmEntry.intprNm)];
            fmYear = fmEntry.vdptYr ? String(fmEntry.vdptYr).slice(0, 4) : '';
          } else {
            // 팜맵에 없는 산(임야)·목장(목장용지·잡종지)은 지목으로 보충
            const jm = getJimok(f.properties?.jibun);
            if (jm === '임') st = { label: '산(임야)', color: '#15803d' };
            else if (jm === '목') st = { label: '목장', color: '#e11d48', emphasis: true };
            else if (jm === '잡') st = { label: '목장(잡종지)', color: '#e11d48', emphasis: true };
          }
        } else {
          st = JIMOK_STYLE[getJimok(f.properties?.jibun)];
        }
        if (!st) continue;               // 농경지/실경작지만 렌더
        if (drawn >= MAX_PARCELS) { skippedAgri++; continue; }
        const stColor = st.color, stLabel = st.label, stEmph = !!st.emphasis;

        const mp: any[] = f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry?.coordinates];
        let firstPath: any = null;
        for (const poly of mp) {
          if (!poly || !poly[0]) continue;
          const path = poly[0].map(([lng, lat]: number[]) => new naver.maps.LatLng(lat, lng));
          if (!firstPath) firstPath = path;
          const polygon = new naver.maps.Polygon({
            map,
            paths: path,
            fillColor: stColor,
            fillOpacity: stEmph ? 0.55 : 0.42,
            strokeColor: stEmph ? '#ffffff' : stColor,
            strokeWeight: stEmph ? 3 : 1.5,
            strokeOpacity: stEmph ? 1 : 0.95,
            clickable: true,
            zIndex: stEmph ? 50 : 1,
          });
          naver.maps.Event.addListener(polygon, 'click', () => {
            const p = f.properties ?? {};
            // 등록 모드: 클릭한 필지를 캡처(InfoWindow 대신 등록 카드)
            if (registerModeRef.current) {
              const ring = path.map((ll: any) => ({ lat: ll.lat(), lng: ll.lng() }));
              const cLat = ring.reduce((s: number, r: any) => s + r.lat, 0) / ring.length;
              const cLng = ring.reduce((s: number, r: any) => s + r.lng, 0) / ring.length;
              setSelected(null);
              setPicked({
                pnu: p.pnu ?? '',
                jibun: p.jibun ?? '',
                addr: p.addr ?? '',
                lat: cLat,
                lng: cLng,
                areaM2: ringAreaM2(ring),
              });
              return;
            }
            const iw = new naver.maps.InfoWindow({
              content:
                `<div style="padding:9px 11px;font-size:12px;line-height:1.55;font-family:inherit">` +
                `<b style="font-size:13px">${p.jibun ?? ''}</b> ` +
                `<span style="color:${stColor};font-weight:700">${stLabel}</span>` +
                `${fmYear ? ` <span style="color:#8c918d">· ${fmYear}판독</span>` : ''}<br/>` +
                `${p.addr ?? ''}<br/>` +
                `공시지가 ${p.jiga ? Number(p.jiga).toLocaleString() + '원/㎡' : '-'}</div>`,
              borderWidth: 1,
            });
            iw.open(map, path[0]);
            parcelOverlays.current.push(iw);
          });
          parcelOverlays.current.push(polygon);
        }

        // 지번 라벨 — 줌 18+ · 최대 개수 제한 (마커가 무거움)
        if (showLabels && labeled < MAX_LABELS && firstPath && firstPath.length) {
          let sx = 0, sy = 0;
          for (const ll of firstPath) { sx += ll.lng(); sy += ll.lat(); }
          const center = new naver.maps.LatLng(sy / firstPath.length, sx / firstPath.length);
          const label = new naver.maps.Marker({
            map,
            position: center,
            clickable: false,
            icon: {
              content:
                `<div style="font-size:10.5px;font-weight:800;color:#fff;` +
                `text-shadow:0 0 2px #000,0 0 2px #000,0 0 3px #000;white-space:nowrap">` +
                `${f.properties?.jibun ?? ''}</div>`,
              anchor: new naver.maps.Point(0, 0),
            },
          });
          parcelOverlays.current.push(label);
          labeled++;
        }
        drawn++;
      }

      if (drawn === 0) {
        const up = geo.upstreamStatus;
        if ((up && up >= 500) || (geo.error && /502|gateway|fetch|timeout/i.test(String(geo.error)))) {
          setCadHint('VWorld 지적 서버 일시 오류(502) · 잠시 후 다시 시도하세요');
        } else if (feats.length === 0) {
          setCadHint('이 영역에 필지 데이터가 없습니다');
        } else if (mapMode === 'farmmap') {
          setCadHint('이 영역에 팜맵 경작지가 없습니다 (도로·시설·비경작지 제외)');
        } else {
          setCadHint(`필지 ${feats.length}건 있으나 농경지 아님 (대지·도로 등)`);
        }
      }
      else setCadHint(
        `${mapMode === 'farmmap' ? '팜맵 경작지' : '농경지'} ${drawn}개${skippedAgri ? ` (+${skippedAgri} · 확대)` : ''}` +
        `${showLabels ? ' · 지번' : ' · 줌 18+ 시 지번'}`
      );
    } catch (e) {
      console.error('[cadastral]', e);
      setCadHint('지적 데이터 로드 실패');
    }
  }, [clearParcels, mapMode]);

  // 헤더 검색 처리 — 좌표(lat/lng) 직접 이동 또는 q 지오코딩
  useEffect(() => {
    if (!sdkLoaded || !mapInstance.current) return;
    const naver = window.naver;

    // 1) 주소 자동완성에서 선택한 정확한 좌표 (재지오코딩 없이 바로 이동)
    if (latParam && lngParam) {
      const key = `${latParam},${lngParam}`;
      if (lastQuery.current === key) return;
      lastQuery.current = key;
      const lat = parseFloat(latParam), lng = parseFloat(lngParam);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const ll = new naver.maps.LatLng(lat, lng);
        mapInstance.current.setCenter(ll);
        mapInstance.current.setZoom(18);
        setMapMode('farmmap');
        if (searchMarker.current) searchMarker.current.setMap(null);
        searchMarker.current = new naver.maps.Marker({ map: mapInstance.current, position: ll, zIndex: 1000 });
        setSearchInfo({ addr: labelParam || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, found: true });
      }
      return;
    }

    // 2) q 지오코딩 (직접 주소 입력 후 엔터한 경우)
    if (!queryParam) return;
    if (lastQuery.current === queryParam) return;
    lastQuery.current = queryParam;

    (async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(queryParam)}`);
        const data = await res.json();
        const hit = data.items?.[0];
        if (!hit) {
          setSearchInfo({ addr: `'${queryParam}' 검색 결과가 없습니다`, found: false });
          return;
        }
        const ll = new naver.maps.LatLng(hit.lat, hit.lng);
        mapInstance.current.setCenter(ll);
        mapInstance.current.setZoom(18);
        setMapMode('farmmap'); // 지적도 모드로 전환해 필지·지번 표시

        if (searchMarker.current) searchMarker.current.setMap(null);
        searchMarker.current = new naver.maps.Marker({
          map: mapInstance.current,
          position: ll,
          zIndex: 1000,
        });
        setSearchInfo({ addr: hit.address || queryParam, found: true });
      } catch (e) {
        console.error('[geocode]', e);
        setSearchInfo({ addr: '검색 중 오류가 발생했습니다', found: false });
      }
    })();
  }, [sdkLoaded, queryParam, latParam, lngParam, labelParam]);

  // 지도 모드 전환 (위성 / 일반지도 / 지적도)
  useEffect(() => {
    if (!sdkLoaded || !mapInstance.current) return;
    const naver = window.naver;
    const map = mapInstance.current;
    const { MapTypeId } = naver.maps;

    // 베이스: 일반지도만 NORMAL, 나머지는 HYBRID(위성+지명)
    map.setMapTypeId(mapMode === 'normal' ? MapTypeId.NORMAL : MapTypeId.HYBRID);

    // 기존 idle 리스너 정리
    if (cadIdle.current) { naver.maps.Event.removeListener(cadIdle.current); cadIdle.current = null; }

    // 지적·팜맵 격자는 "필지 등록 모드"에서만 표시 — 평소엔 내 필지 폴리곤 영역만 깔끔히 보이게
    if ((mapMode === 'cadastral' || mapMode === 'farmmap') && registerMode) {
      const debounced = () => {
        if (cadTimer.current) clearTimeout(cadTimer.current);
        cadTimer.current = setTimeout(loadParcels, 280);
      };
      cadIdle.current = naver.maps.Event.addListener(map, 'idle', debounced);
      loadParcels();
    } else {
      clearParcels();
    }

    return () => {
      if (cadIdle.current) { naver.maps.Event.removeListener(cadIdle.current); cadIdle.current = null; }
      if (cadTimer.current) { clearTimeout(cadTimer.current); cadTimer.current = null; }
    };
  }, [sdkLoaded, mapMode, registerMode, loadParcels, clearParcels]);

  // 선택 필지 → 백엔드 AI-1 적합도(공공데이터 기반). landId 없으면 비움.
  useEffect(() => {
    if (!selected?.properties.landId) { setAiCands([]); setAiSummary(''); setAiFactors(null); return; }
    const p = selected.properties;
    setAiLoading(true);

    // 필지명(예: "378답", "102전", "5과")에서 지목 추출 → 카테고리 강제 지정
    const JIMOK_MAP: Record<string, string> = {
      '답': '논', '전': '밭', '과': '과수', '목': '축산', '임': '밭',
      '대': '밭', '원': '과수', '유': '밭', '잡': '잡종지',
    };
    const jimokChar = (p.landName ?? '').match(/[답전과목임대원유잡]$/)?.[0] ?? '';
    const landType = JIMOK_MAP[jimokChar] ?? null;

    // 백엔드 카테고리 불일치 감지 (논인데 과수 추천 등)
    const PADDY_CROPS = ['벼','이탈리안 라이그라스','콩','청보리','호밀','마늘','양파','미나리','연근','총체벼'];
    const ORCHARD_CROPS = ['사과','배','복숭아','포도','샤인머스캣','감귤','단감','자두','매실','블루베리','키위','망고'];
    function isMismatch(cat: string | null, backendCrops: string[]): boolean {
      if (!cat) return false;
      if (cat === '논') return backendCrops.some(c => ORCHARD_CROPS.includes(c));
      if (cat === '밭') return backendCrops.every(c => ORCHARD_CROPS.includes(c));
      return false;
    }

    // 축산·잡종지는 사육 축종에 따라 달라 AI 경축 추천 생략
    if (landType === '잡종지' || landType === '축산') {
      setAiCands([]); setAiSummary(''); setAiFactors(null); setAiLoading(false); return;
    }

    const fetchLocal = async (cur: string) => {
      const params = new URLSearchParams({
        currentCrop: landType === '논' ? (PADDY_CROPS.includes(cur) ? cur : '벼') : cur,
        address: p.address ?? '',
        altitude: String(p.altitude ?? 0),
        slope: String(p.slope ?? 0),
        soil: p.soil ?? '',
        ...(landType ? { landType } : {}),
      });
      const res = await fetch(`/api/ai/suitability?${params}`);
      return res.ok ? res.json() : null;
    };

    landsApi.getSuitability(p.landId)
      .then(async (r) => {
        const data = r.data.data;
        const cur = data.currentCrop ?? p.currentCrop ?? '';
        const fSrc = (data.candidates ?? []).find((c) => c.crop === cur) ?? data.candidates?.[0];
        setAiFactors(fSrc?.factors ?? null);

        const backendCropNames = (data.candidates ?? []).map((c) => c.crop);
        const hasMismatch = isMismatch(landType, backendCropNames);
        const needsLocal = hasMismatch || (data.candidates ?? []).some((c) => !c.reasons?.length);

        const localData = needsLocal ? await fetchLocal(cur).catch(() => null) : null;

        // 카테고리 불일치 → 로컬 AI 전면 사용
        if (hasMismatch && localData?.crops?.length) {
          setAiCands(localData.crops);
          setAiSummary(localData.summary ?? '');
          return;
        }

        const localMap: Record<string, string[]> = {};
        if (localData?.crops) {
          for (const lc of localData.crops) localMap[lc.name.replace(' (현재)', '')] = lc.reasons ?? [];
        }

        const cands = (data.candidates ?? []).slice(0, 4).map((c, i) => ({
          rank: c.rank ?? i + 1,
          name: c.crop + (c.crop === cur ? ' (현재)' : ''),
          current: c.crop === cur,
          score: c.suitabilityScore ?? c.score ?? 0,
          revenue: typeof c.expectedRevenuePerHa === 'number' ? `${Math.round(c.expectedRevenuePerHa / 1000).toLocaleString()}k` : '—',
          risk: Math.max(1, Math.min(5, Math.round((c.riskFactors?.[0]?.score ?? 0.4) * 5))),
          reasons: c.reasons?.length ? c.reasons : (localMap[c.crop] ?? c.riskFactors?.map((rf) => rf.note).filter((n): n is string => !!n) ?? []),
        }));

        if (cands.length === 0) {
          const local = localData ?? await fetchLocal(cur).catch(() => null);
          setAiCands(local?.crops ?? []); setAiSummary(local?.summary ?? ''); return;
        }

        setAiCands(cands);
        setAiSummary(localData?.summary || (cands[0] ? `공공데이터(토양·기상·일조) 분석 결과 '${cands[0].name.replace(' (현재)', '')}'이(가) 가장 적합합니다(적합도 ${cands[0].score}). 상위 ${cands.length}종 추천.` : ''));
      })
      .catch(async () => {
        const local = await fetchLocal(p.currentCrop ?? '').catch(() => null);
        if (local?.crops?.length) { setAiCands(local.crops); setAiSummary(local.summary ?? ''); }
        else { setAiCands([]); setAiSummary(''); setAiFactors(null); }
      })
      .finally(() => setAiLoading(false));
  }, [selected]);

  // 필지 목록에서 클릭 → 해당 필지로 확대 + 선택
  const centerOnFeature = (f: LandFeature) => {
    const naver = window.naver;
    const ring = f.geometry?.coordinates?.[0];
    if (!naver || !mapInstance.current || !ring?.length) { setSelected(f); return; }
    const cLng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    const cLat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    mapInstance.current.setCenter(new naver.maps.LatLng(cLat, cLng));
    mapInstance.current.setZoom(18);
    setSelected(f);
  };

  const scriptSrc = CLIENT_ID
    ? `https://openapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${CLIENT_ID}`
    : null;

  return (
    <div className="relative -mx-7 -mt-6 -mb-14 overflow-hidden" style={{ height: 'calc(100vh - 72px)' }}>
      {/* Naver Maps SDK — callback 방식으로 안정적 초기화 */}
      {scriptSrc && (
        <Script
          src={scriptSrc}
          strategy="afterInteractive"
          onReady={() => initMap()}
          onLoad={() => initMap()}
          onError={() => setMapError('Naver Maps 스크립트 로드 실패 — 네트워크 또는 clientId 확인')}
        />
      )}

      {/* clientId 없을 때 */}
      {!CLIENT_ID && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#e8eae5]">
          <div className="bg-white rounded-2xl p-6 max-w-sm text-sm border border-border-soft text-center">
            <AlertTriangle className="mx-auto mb-3 text-warn" size={32} />
            <div className="font-bold mb-2">NEXT_PUBLIC_NAVER_CLIENT_ID 미설정</div>
            <div className="text-fg-muted text-xs leading-relaxed">.env.local에 키가 없습니다. 개발 서버를 재시작하세요.</div>
          </div>
        </div>
      )}

      {/* 지도 컨테이너 — 부모 높이를 그대로 채움 */}
      <div ref={mapRef} className="w-full h-full" />

      {/* SDK 에러 */}
      {mapError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#e8eae5]">
          <div className="bg-white rounded-2xl p-6 max-w-md border border-border-soft">
            <div className="flex gap-3 mb-3">
              <AlertTriangle className="text-warn flex-none mt-0.5" size={20} />
              <div className="font-bold text-[14px]">지도 로드 실패</div>
            </div>
            <pre className="text-xs text-fg-soft whitespace-pre-wrap leading-relaxed bg-bg-soft rounded-lg p-3 mb-4">{mapError}</pre>
            <div className="text-xs text-fg-muted leading-relaxed">
              <strong>해결 방법:</strong><br/>
              1. <a href="https://console.ncloud.com" target="_blank" rel="noreferrer" className="text-info underline">console.ncloud.com</a> 로그인<br/>
              2. Services → AI·NAVER API → Application<br/>
              3. 해당 앱 변경 → &ldquo;Web 서비스 URL&rdquo; 에 <code className="bg-bg-soft px-1 rounded">http://localhost:3000</code> 추가<br/>
              4. 저장 후 페이지 새로고침
            </div>
          </div>
        </div>
      )}

      {/* 데이터 로딩 */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-xl px-6 py-4 text-sm font-semibold text-fg-soft">필지 데이터 불러오는 중…</div>
        </div>
      )}

      {/* SDK 로드 대기 (데이터는 왔는데 지도 아직) */}
      {!sdkLoaded && !loading && !mapError && CLIENT_ID && (
        <div className="absolute inset-0 z-2 flex items-center justify-center bg-[#e8eae5]">
          <div className="text-sm text-fg-soft text-center">
            <div className="font-semibold">지도 SDK 로드 중…</div>
            <div className="text-xs text-fg-muted mt-1">clientId: {CLIENT_ID}</div>
          </div>
        </div>
      )}

      {/* 상단 컨트롤 */}
      <div className="absolute top-4 left-4 right-4 z-5 flex justify-between gap-3 pointer-events-none">
        {/* 줌 툴바 */}
        <div className="bg-white/95 border border-border-soft rounded-[10px] p-1.5 flex gap-1.5 pointer-events-auto">
          {[
            { label: '+', fn: () => mapInstance.current?.setZoom((mapInstance.current.getZoom() ?? 14) + 1) },
            { label: '−', fn: () => mapInstance.current?.setZoom((mapInstance.current.getZoom() ?? 14) - 1) },
            { label: '↺', fn: () => {
              if (!mapInstance.current) return;
              const nv = window.naver;
              // 검색한 주소가 있으면 그 위치로, 없으면 기본(고삼면)
              const sLat = parseFloat(latParam ?? ''), sLng = parseFloat(lngParam ?? '');
              if (Number.isFinite(sLat) && Number.isFinite(sLng)) {
                mapInstance.current.setCenter(new nv.maps.LatLng(sLat, sLng));
                mapInstance.current.setZoom(18);
              } else {
                mapInstance.current.setCenter(new nv.maps.LatLng(35.5603, 128.1655));
                mapInstance.current.setZoom(16);
              }
            } },
          ].map(({ label, fn }) => (
            <button key={label} onClick={fn} className="w-8 h-8 rounded-md text-fg font-bold hover:bg-bg-soft">{label}</button>
          ))}
        </div>

        {/* 필터 */}
        <div className="bg-white/95 border border-border-soft border-l-4 border-l-brand rounded-[10px] px-3.5 py-2 flex items-center gap-2.5 pointer-events-auto">
          {isAdmin && (
            <>
              <span className="text-[10.5px] text-fg-muted font-bold tracking-wider uppercase">조합원</span>
              <div className="relative">
                <select
                  value={activeMemberId}
                  onChange={(e) => { setSelected(null); setActiveMemberId(e.target.value); fetchLands(e.target.value); }}
                  className="appearance-none bg-white border border-border-soft text-fg font-bold pl-2 pr-7 py-1 rounded-md text-[13px] cursor-pointer"
                >
                  <option value="default">전체 ({members.length}명)</option>
                  {members.map((m) => (
                    <option key={m.memberId} value={m.memberId}>{m.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-fg-muted" />
              </div>
            </>
          )}
          <span className="text-[10.5px] text-fg-muted font-bold tracking-wider uppercase ml-1">지도</span>
          <div className="relative">
            <select
              value={mapMode}
              onChange={(e) => setMapMode(e.target.value as 'satellite' | 'normal' | 'cadastral' | 'farmmap')}
              className="appearance-none bg-white border border-border-soft text-fg font-bold pl-2 pr-7 py-1 rounded-md text-[13px] cursor-pointer"
            >
              <option value="farmmap">팜맵(실제 경작)</option>
              <option value="satellite">위성</option>
              <option value="normal">일반지도</option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          </div>
          <button
            type="button"
            onClick={() => {
              if (registerMode) { setRegisterMode(false); setPicked(null); }
              else {
                if (mapMode !== 'farmmap' && mapMode !== 'cadastral') setMapMode('farmmap');
                setSelected(null);
                setRegisterMode(true);
                setCadHint('');
                // 필지를 고를 수 있게 사용자 위치 중앙 + 확대(파슬이 보이는 줌)
                const nv = window.naver;
                const map = mapInstance.current;
                if (nv && map) {
                  const first = features[0]?.geometry?.coordinates?.[0];
                  if (first?.length) {
                    const cLng = first.reduce((s, c) => s + c[0], 0) / first.length;
                    const cLat = first.reduce((s, c) => s + c[1], 0) / first.length;
                    map.setCenter(new nv.maps.LatLng(cLat, cLng));
                  }
                  map.setZoom(Math.max(map.getZoom?.() ?? 0, 18));
                }
              }
            }}
            className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-bold border ml-1',
              registerMode ? 'bg-brand text-white border-brand' : 'bg-white text-brand-deep border-brand/40 hover:bg-brand-soft',
            )}
          >
            <MapPinPlus size={14} /> {registerMode ? '등록 취소' : '필지 등록'}
          </button>
        </div>
      </div>

      {/* 지적도 모드 안내 (키 없음 / 줌 안내 / 로드 상태) */}
      {mapMode === 'cadastral' && !VWORLD_KEY && (
        <div className="absolute top-19 left-1/2 -translate-x-1/2 z-10 bg-warn-bg border border-warn/30 text-warn rounded-lg px-4 py-2.5 text-[12.5px] font-semibold max-w-md text-center pointer-events-none">
          지적도를 보려면 VWorld API 키가 필요합니다 · vworld.kr에서 무료 발급 후 .env.local의 NEXT_PUBLIC_VWORLD_API_KEY에 입력
        </div>
      )}
      {(mapMode === 'cadastral' || mapMode === 'farmmap') && VWORLD_KEY && cadHint && !searchInfo && !registerMode && (
        <div className="absolute top-19 left-1/2 -translate-x-1/2 z-10 bg-white/95 border border-border-soft text-fg-soft rounded-lg px-4 py-2 text-[12.5px] font-semibold max-w-md text-center pointer-events-none">
          {cadHint}
        </div>
      )}

      {/* 검색 결과 배너 */}
      {searchInfo && (
        <div className={clsx(
          'absolute top-19 left-1/2 -translate-x-1/2 z-10 rounded-lg px-4 py-2 text-[12.5px] font-semibold max-w-md flex items-center gap-2',
          searchInfo.found ? 'bg-white/95 border border-brand text-fg' : 'bg-warn-bg border border-warn/30 text-warn'
        )}>
          {searchInfo.found && <span className="w-2 h-2 rounded-full bg-brand flex-none" />}
          <span className="truncate">{searchInfo.addr}</span>
          <button
            onClick={() => { setSearchInfo(null); if (searchMarker.current) { searchMarker.current.setMap(null); searchMarker.current = null; } }}
            className="ml-1 text-fg-muted hover:text-fg flex-none"
            aria-label="검색 결과 닫기"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* 등록 모드 안내 */}
      {registerMode && !picked && (
        <div className="absolute top-19 left-1/2 -translate-x-1/2 z-10 bg-white border border-border-soft text-fg rounded-lg px-4 py-2 text-[12.5px] font-bold flex items-center gap-2 pointer-events-none">
          <MapPinPlus size={14} className="text-brand-deep" /> 지도에서 등록할 내 필지를 클릭하세요
          {isAdmin && activeMemberId === 'default' && <span className="text-fg-muted">· 먼저 조합원을 선택하세요</span>}
        </div>
      )}

      {/* 필지 등록 카드 */}
      {picked && (
        <aside className="absolute top-19 right-4 z-10 w-80 max-w-[calc(100%-2rem)] bg-white rounded-2xl border border-border-soft overflow-hidden">
          <div className="flex justify-between items-center px-4.5 py-3.5 border-b border-border-soft bg-brand-soft">
            <div className="font-extrabold text-[14.5px] flex items-center gap-1.5"><MapPinPlus size={15} className="text-brand-deep" /> 필지 등록</div>
            <button onClick={() => setPicked(null)} className="w-7 h-7 rounded-md border border-border-soft bg-white text-fg-muted hover:bg-bg-soft">
              <X size={14} className="mx-auto" />
            </button>
          </div>
          <div className="px-4.5 py-4 grid gap-3">
            <div className="text-[12.5px] grid gap-1.5 p-3 rounded-[10px] bg-bg-soft">
              <div className="flex justify-between gap-3"><span className="text-fg-muted">지번</span><span className="font-semibold text-right">{picked.jibun || '-'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-fg-muted">주소</span><span className="font-semibold text-right truncate">{picked.addr || '-'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-fg-muted">PNU</span><span className="font-semibold text-right">{picked.pnu || '-'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-fg-muted">면적</span><span className="font-semibold text-right">{Math.round(picked.areaM2).toLocaleString()} ㎡ ({(picked.areaM2 / 10000).toFixed(2)} ha)</span></div>
            </div>
            <div>
              <label className="block text-xs font-bold text-fg-soft mb-1.5">필지 이름</label>
              <input
                value={regForm.name}
                onChange={(e) => setRegForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={picked.jibun ? `예: ${picked.jibun}` : '예: 동쪽 사과밭'}
                className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-fg-soft mb-1.5">경축 (작물·축산)</label>
              <ComboInput value={regForm.crop} onChange={(v) => setRegForm((f) => ({ ...f, crop: v, headCount: null }))} options={KYEONGCHUK} placeholder="목록에서 선택 또는 직접 입력 (예: 사과 / 한우)" />
            </div>
            {LIVESTOCK.includes(regForm.crop) && (
              <div>
                <label className="block text-xs font-bold text-fg-soft mb-1.5">사육 두수 <span className="text-fg-muted font-normal">(마리)</span></label>
                <input
                  type="number"
                  min={1}
                  value={regForm.headCount ?? ''}
                  onChange={(e) => setRegForm((f) => ({ ...f, headCount: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="예: 30"
                  className="w-full px-3 py-2.5 rounded-[9px] border border-border-soft bg-white text-[13.5px] focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand-soft"
                />
              </div>
            )}
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                disabled={createLand.isPending || !regForm.crop.trim() || (isAdmin && activeMemberId === 'default')}
                onClick={() => createLand.mutate()}
                className="flex-1 px-3 py-2.5 rounded-[9px] bg-brand text-white font-bold text-[13.5px] hover:bg-brand-deep disabled:opacity-50"
              >
                {createLand.isPending ? '등록 중…' : '등록'}
              </button>
              <button type="button" onClick={() => setPicked(null)} className="px-3 py-2.5 rounded-[9px] border border-border-soft bg-white font-bold text-[13.5px] text-fg-soft hover:bg-bg-soft">취소</button>
            </div>
            {isAdmin && activeMemberId === 'default' && (
              <div className="text-[11.5px] text-warn font-semibold">상단에서 등록 대상 조합원을 먼저 선택하세요.</div>
            )}
          </div>
        </aside>
      )}

      {/* 우측 패널 */}
      {selected && !picked && (
        <aside className="absolute top-19 right-4 bottom-4 w-90 max-w-[calc(100%-2rem)] z-5 bg-white rounded-2xl border border-border-soft flex flex-col overflow-hidden">
          <div className="flex justify-between items-center px-4.5 py-3.5 border-b border-border-soft">
            <div>
              <div className="font-extrabold text-[15px]">{selected.properties.landName}</div>
              <div className="text-[11.5px] text-fg-muted mt-0.5">{isAdmin && selected.properties.memberId ? `${memberName(selected.properties.memberId)} · ` : ''}{selected.properties.pnu}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { if (selected && confirm('이 필지를 삭제할까요?')) deleteLand.mutate(selected.properties.landId); }}
                disabled={deleteLand.isPending}
                className="w-7 h-7 rounded-md border border-border-soft bg-white text-danger hover:bg-danger-bg disabled:opacity-50"
                title="필지 삭제"
              >
                <Trash2 size={13} className="mx-auto" />
              </button>
              <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-md border border-border-soft bg-white text-fg-muted hover:bg-bg-soft">
                <X size={14} className="mx-auto" />
              </button>
            </div>
          </div>
          <div className="px-4.5 py-4 overflow-y-auto">
            {/* 적합도 */}
            <div className="flex items-center gap-3 mb-4 p-3 rounded-[10px] bg-bg-soft">
              <div
                className="w-12 h-12 rounded-full grid place-items-center text-white font-extrabold text-base flex-none"
                style={{ background: scoreToBorderColor(selected.properties.suitabilityScore) }}
              >
                {selected.properties.suitabilityScore}
              </div>
              <div>
                <div className="font-bold text-[13.5px]">현재 경축 적합도</div>
                <div className="text-xs text-fg-muted mt-0.5">
                  {selected.properties.suitabilityScore >= 80 ? '높음 ✓' : selected.properties.suitabilityScore >= 60 ? '중간' : '낮음 — 전환 검토 권장'}
                </div>
              </div>
            </div>

            {/* 기본 정보 */}
            <div className="text-[12.5px] text-fg-muted mb-2.5">기본 정보</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px] mb-4">
              {[
                ['PNU', selected.properties.pnu],
                ['면적', `${selected.properties.areaHa} ha`],
                ['현재 경축', selected.properties.currentCrop],
                ['주소', selected.properties.address ?? '-'],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-fg-muted">{k}</dt>
                  <dd className="m-0 font-semibold truncate">{v}</dd>
                </div>
              ))}
            </dl>

            {/* 환경 분석 (공공데이터 — 토양·기후·일조·경사) */}
            <div className="flex items-center gap-1.5 text-[12.5px] text-fg-muted mb-2">
              환경 분석
              <span className="text-[10px] text-fg-muted/70">토양·기상 공공데이터</span>
            </div>
            {aiFactors ? (
              <div className="grid grid-cols-2 gap-2 mb-4.5">
                {([['토양', aiFactors.soil], ['기후', aiFactors.climate], ['일조', aiFactors.sunlight], ['경사', aiFactors.slope]] as Array<[string, number]>).map(([k, v]) => (
                  <div key={k} className="rounded-[9px] bg-bg-soft px-3 py-2">
                    <div className="flex items-center justify-between text-[12px]"><span className="text-fg-muted">{k}</span><span className="font-extrabold" style={{ color: scoreToBorderColor(v) }}>{v}</span></div>
                    <div className="h-1.5 mt-1.5 rounded-full bg-white overflow-hidden"><div className="h-full rounded-full" style={{ width: `${v}%`, background: scoreToBorderColor(v) }} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11.5px] text-fg-muted bg-bg-soft rounded-[9px] px-3 py-2.5 mb-4.5">필지 선택 시 토양·기상 공공데이터로 환경을 분석합니다.</div>
            )}

            {/* AI 경축 적합도 */}
            {['잡','목'].includes((selected.properties.landName ?? '').match(/[답전과목임대원유잡]$/)?.[0] ?? '') ? (
              <div className="text-[12px] text-fg-muted bg-bg-soft rounded-[10px] px-3 py-3 leading-relaxed">
                축산·잡종지는 사육 축종(한우·양돈·육계 등)에 따라 적합 경축이 달라 자동 추천이 어렵습니다. 담당 지도사에게 개별 상담을 권장합니다.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="text-[12.5px] text-fg-muted">AI 경축 적합도</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-brand-soft text-brand-deep text-[9.5px] font-extrabold tracking-wide">
                    <Sparkles size={10} /> AI 분석
                  </span>
                </div>
                {aiSummary && (
                  <div className="text-[11.5px] text-fg-soft leading-relaxed bg-brand-soft/60 border border-brand-soft rounded-[10px] px-3 py-2 mb-2.5">
                    {aiSummary}
                  </div>
                )}
                {aiLoading ? (
                  <div className="text-[12px] text-fg-muted py-4 text-center">AI가 토양·고도·경사를 분석 중…</div>
                ) : (
                  <div className="grid gap-1.5">
                    {aiCands.map((c) => (
                      <div
                        key={c.rank}
                        className={clsx(
                          'grid grid-cols-[auto_1fr_auto] gap-2.5 items-start px-3 py-2.5 rounded-[10px] border',
                          c.current ? 'bg-brand-soft border-brand' : 'bg-bg-soft border-border-soft'
                        )}
                      >
                        <span className="w-5.5 h-5.5 mt-0.5 rounded-full bg-white border border-border-soft grid place-items-center text-[11px] font-extrabold">{c.rank}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-[13px]">{c.name}</div>
                          <div className="text-[11px] text-fg-muted">₩/ha {c.revenue} · 위험 {c.risk}</div>
                          {c.reasons?.length > 0 && (
                            <ul className="mt-1 text-[10.5px] text-fg-soft leading-snug list-disc pl-3.5">
                              {c.reasons.map((rs, i) => <li key={i}>{rs}</li>)}
                            </ul>
                          )}
                        </div>
                        <div className="font-extrabold text-brand-deep text-[15px]">{c.score}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="mt-3.5 grid gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (!selected) return;
                  const params = new URLSearchParams({ landId: selected.properties.landId });
                  if (selected.properties.memberId) params.set('memberId', selected.properties.memberId);
                  router.push(`/scenarios?${params.toString()}`);
                }}
                className="w-full justify-center inline-flex items-center px-3 py-2 rounded-[10px] bg-brand text-white text-[13.5px] font-semibold hover:bg-brand-deep"
              >
                이 필지로 시나리오 만들기
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* 필지 목록 — 로딩 중에도 패널 표시, 클릭 시 해당 필지로 확대 */}
      {!registerMode && (loading || features.length > 0) && (
        <div className="absolute top-19 left-4 z-5 w-60 max-w-[calc(100%-2rem)]">
          {listOpen ? (
            <div className="bg-white/97 border border-border-soft rounded-xl overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
              <button type="button" onClick={() => setListOpen(false)} className="flex items-center justify-between px-3.5 py-2.5 border-b border-border-soft w-full hover:bg-bg-soft">
                <span className="font-bold text-[13px]">내 필지 {loading ? <span className="text-fg-muted text-[11px] font-normal">불러오는 중…</span> : <span className="text-brand-deep">{features.length}</span>}</span>
                <ChevronDown size={15} className="text-fg-muted rotate-180" />
              </button>
              <div className="overflow-y-auto p-1.5 grid gap-1">
                {loading && features.length === 0 && (
                  <div className="py-6 text-center text-[12px] text-fg-muted">필지 데이터를 불러오는 중…</div>
                )}
                {features.map((f) => {
                  const on = selected?.properties.landId === f.properties.landId;
                  const memberClr = isAdmin && f.properties.memberId
                    ? getMemberColor(f.properties.memberId)
                    : { fill: 'rgba(37,99,235,0.50)', border: '#1d4ed8' };
                  const dotColor = memberClr.border;
                  return (
                    <button
                      key={f.properties.landId}
                      type="button"
                      onClick={() => centerOnFeature(f)}
                      className={clsx('flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left w-full', on ? 'bg-brand-soft' : 'hover:bg-bg-soft')}
                    >
                      <span className="w-6 h-6 rounded-md grid place-items-center text-white text-[11px] font-extrabold flex-none" style={{ background: dotColor }}>
                        {isAdmin && f.properties.memberId ? memberName(f.properties.memberId).slice(0, 1) : f.properties.suitabilityScore}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-[12.5px] truncate">{f.properties.landName}</span>
                        <span className="block text-[11px] text-fg-muted truncate">{f.properties.currentCrop} · {f.properties.areaHa}ha{isAdmin && f.properties.memberId ? ` · ${memberName(f.properties.memberId)}` : ''}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setListOpen(true)} className="bg-white/97 border border-border-soft rounded-xl px-3.5 py-2.5 flex items-center gap-2 hover:bg-bg-soft">
              <span className="font-bold text-[13px]">내 필지 <span className="text-brand-deep">{features.length}</span></span>
              <ChevronDown size={15} className="text-fg-muted" />
            </button>
          )}
        </div>
      )}

      {/* 범례 */}
      <div className="absolute bottom-4 left-4 z-5 bg-white/95 border border-border-soft rounded-[10px] px-3 py-2.5 text-xs grid gap-1.5">
        {mapMode === 'farmmap' && registerMode ? (
          <>
            <div className="text-[10.5px] font-bold text-fg-muted tracking-wider uppercase mb-0.5">팜맵 (실제 경작)</div>
            {FARMMAP_CATS.map((k) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: FARMMAP_STYLE[k].color }} />
                <span>{FARMMAP_STYLE[k].label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: '#15803d' }} />
              <span>산(임야)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-white" style={{ background: '#e11d48' }} />
              <span>목장(목장용지·잡종지)</span>
            </div>
            <div className="text-[10.5px] text-fg-muted mt-0.5 border-t border-border-soft pt-1.5">
              논·밭·과수·시설=항공영상 실측 / 산·목장=지목 · 도로·골프장 제외
            </div>
          </>
        ) : mapMode === 'cadastral' && registerMode ? (
          <>
            <div className="text-[10.5px] font-bold text-fg-muted tracking-wider uppercase mb-0.5">경작지</div>
            {CROP_JIMOK.map((k) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: JIMOK_STYLE[k].color }} />
                <span>{JIMOK_STYLE[k].label}</span>
              </div>
            ))}
            <div className="text-[10.5px] font-bold text-fg-muted tracking-wider uppercase mt-1 mb-0.5">축산·시설</div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-white" style={{ background: JIMOK_STYLE['목'].color }} />
              <span>목장용지(축사)·목장(잡종지)·창고용지</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-60">
              <span className="w-3 h-3 rounded-sm border border-border-strong" style={{ background: JIMOK_DEFAULT.color }} />
              <span>기타 (선택 불가)</span>
            </div>
            <div className="text-[10.5px] text-fg-muted mt-0.5 border-t border-border-soft pt-1.5">
              경작지·축산만 색·지번 표시 · 클릭 시 상세
            </div>
          </>
        ) : (
          <>
            <div className="text-[10.5px] font-bold text-fg-muted tracking-wider uppercase mb-0.5">경축 적합도</div>
            {[['#339940', '높음 (80+)'], ['#a16207', '중간 (60–79)'], ['#b91c1c', '낮음 (60 미만)']].map(([col, t]) => (
              <div key={t} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: col }} />
                <span>{t}</span>
              </div>
            ))}
            <div className="text-[10.5px] text-fg-muted mt-0.5 border-t border-border-soft pt-1.5">
              {features.length > 0 ? `필지 ${features.length}개 로드됨` : 'MAFRA API 목 데이터'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
