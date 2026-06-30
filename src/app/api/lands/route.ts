import { NextRequest, NextResponse } from 'next/server';

// 필지/경축 = 백엔드 실데이터(GET /lands)를 단일 출처로 사용한다.
// 백엔드 필지는 PNU·위경도·면적·경축만 주고 "폴리곤 경계"는 없으므로,
// 각 필지의 위경도로 VWorld 연속지적도(WFS)를 조회해 그 지점의 실제 필지 폴리곤을 입힌다.
// (백엔드 PNU는 시드 단계라 실제 지적도와 불일치할 수 있어, 위경도 기반 조회가 더 신뢰도 높음)

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://farmu.gbsw.hs.kr';
const VWORLD_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY ?? '';

interface BackendLand {
  landId: string;
  memberId: string;
  name: string;
  pnu: string;
  address: string;
  latitude: number;
  longitude: number;
  area: number; // m²
  mainCrop: string;
  headCount?: number | null;
}

type Ring = number[][]; // [[lng,lat], ...]

interface LandFeature {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  properties: {
    landId: string;
    pnu: string;
    areaHa: number;
    currentCrop: string;
    suitabilityScore: number;
    memberId: string;
    landName: string;
    soil: string;
    slope: number;
    altitude: number;
    address?: string;
    headCount?: number | null;
  };
}

// ── 기하 유틸 ────────────────────────────────────────────────────
function ringContains(ring: Ring, lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
function ringCentroid(ring: Ring): [number, number] {
  let x = 0, y = 0;
  for (const [lng, lat] of ring) { x += lng; y += lat; }
  return [x / ring.length, y / ring.length];
}
// VWorld geometry(Polygon/MultiPolygon) → 외곽링([[lng,lat],...]) 목록
function outerRings(geom: any): Ring[] {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates[0]];
  if (geom.type === 'MultiPolygon') return geom.coordinates.map((poly: number[][][]) => poly[0]);
  return [];
}

// ── VWorld 연속지적도에서 (lat,lng) 지점의 필지 폴리곤 조회 ──────────
async function fetchParcelAt(lat: number, lng: number): Promise<{ ring: Ring; pnu?: string; addr?: string } | null> {
  if (!VWORLD_KEY) return null;
  const d = 0.0016; // ~170m 박스
  const bbox = `${lat - d},${lng - d},${lat + d},${lng + d}`;
  const url =
    `https://api.vworld.kr/req/wfs?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0` +
    `&TYPENAME=lp_pa_cbnd_bubun&BBOX=${bbox}&SRSNAME=EPSG:4326` +
    `&OUTPUT=application/json&KEY=${VWORLD_KEY}&DOMAIN=http://localhost:3000&count=100`;

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        const json = JSON.parse(text);
        const feats: any[] = json.features ?? [];
        if (feats.length === 0) return null;

        // 1) 점을 포함하는 필지 우선, 2) 없으면 중심이 가장 가까운 필지
        let best: { ring: Ring; props: any } | null = null;
        let bestDist = Infinity;
        for (const f of feats) {
          for (const ring of outerRings(f.geometry)) {
            if (ringContains(ring, lng, lat)) return { ring, pnu: f.properties?.pnu, addr: f.properties?.addr };
            const [cx, cy] = ringCentroid(ring);
            const dist = (cx - lng) ** 2 + (cy - lat) ** 2;
            if (dist < bestDist) { bestDist = dist; best = { ring, props: f.properties }; }
          }
        }
        return best ? { ring: best.ring, pnu: best.props?.pnu, addr: best.props?.addr } : null;
      }
    } catch {
      /* 재시도 */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

// VWorld 실패 시: 위경도 주변 소형 사각형(약 50m) — 위치만은 정확히
function squareAround(lat: number, lng: number): Ring {
  const d = 0.00025;
  return [
    [lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d],
  ];
}

// ── 적합도 점수 (best-effort) ────────────────────────────────────
async function fetchScore(landId: string, token: string): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/lands/${landId}/suitability`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return 72;
    const json = await res.json();
    const cands: Array<{ score?: number }> = json?.data?.candidates ?? [];
    const max = cands.reduce((m, c) => Math.max(m, c.score ?? 0), 0);
    return max || 72;
  } catch {
    return 72;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const memberId = searchParams.get('memberId') ?? '';
  // 쿠키 우선, 없으면 Authorization 헤더(localStorage 기반 세션 대응)
  const token =
    req.cookies.get('accessToken')?.value ||
    req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ||
    '';

  // 미인증 → 빈 결과
  if (!token) {
    return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'no-auth' });
  }

  try {
    // 1) 백엔드 실제 필지 조회 (memberId 지정 시 필터, 'default'/빈값은 조합 전체)
    const landsUrl = new URL(`${API_BASE}/api/v1/lands`);
    if (memberId && memberId !== 'default') landsUrl.searchParams.set('memberId', memberId);
    const landsRes = await fetch(landsUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!landsRes.ok) {
      return NextResponse.json({ type: 'FeatureCollection', features: [], error: `backend ${landsRes.status}` });
    }
    const allLands: BackendLand[] = (await landsRes.json())?.data ?? [];
    // 좌표가 한국 범위(위 33~39, 경 124~132) 밖이면 합천 기본 좌표로 대체 (시드 데이터 대응)
    const DEFAULT_LAT = 35.5603;
    const DEFAULT_LNG = 128.1655;
    const inKorea = (lat: number, lng: number) => lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
    const lands = allLands.map((l) => ({
      ...l,
      latitude: inKorea(l.latitude, l.longitude) ? l.latitude : DEFAULT_LAT,
      longitude: inKorea(l.latitude, l.longitude) ? l.longitude : DEFAULT_LNG,
    }));

    console.log(`[lands API] backend=${allLands.length} valid=${lands.filter((l) => inKorea(l.latitude, l.longitude)).length}`);

    // 2) 각 필지: 위경도 → VWorld 폴리곤 + 적합도
    const features: LandFeature[] = await Promise.all(
      lands.map(async (l) => {
        const [parcel, score] = await Promise.all([
          fetchParcelAt(l.latitude, l.longitude),
          fetchScore(l.landId, token),
        ]);
        const ring = parcel?.ring ?? squareAround(l.latitude, l.longitude);
        return {
          type: 'Feature' as const,
          geometry: { type: 'Polygon' as const, coordinates: [ring] },
          properties: {
            landId: l.landId,
            pnu: parcel?.pnu ?? l.pnu, // VWorld 실제 PNU 우선
            areaHa: Math.round((l.area / 10000) * 100) / 100,
            currentCrop: l.mainCrop,
            suitabilityScore: score,
            memberId: l.memberId,
            landName: l.name,
            soil: '-',
            slope: 0,
            altitude: 0,
            address: parcel?.addr ?? l.address,
            headCount: l.headCount ?? null,
          },
        };
      }),
    );

    return NextResponse.json({ type: 'FeatureCollection', features });
  } catch (err) {
    console.error('[lands API]', err);
    return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'exception' });
  }
}
