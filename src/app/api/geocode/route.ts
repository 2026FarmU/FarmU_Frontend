import { NextRequest, NextResponse } from 'next/server';

const KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY ?? '';

export const dynamic = 'force-dynamic';

interface GeoItem { title: string; address: string; lat: number; lng: number; kind: string; score: number }

async function vsearch(query: string, type: string, category: string): Promise<any[]> {
  const url =
    `https://api.vworld.kr/req/search?service=search&request=search&version=2.0` +
    `&crs=EPSG:4326&size=100&page=1&query=${encodeURIComponent(query)}` +
    `&type=${type}${category ? `&category=${category}` : ''}&format=json` +
    `&key=${KEY}&domain=http://localhost:3000`;
  const res = await fetch(url, { cache: 'no-store' });
  // VWORLD 서버 장애(502 등)는 빈 결과로 삼키지 말고 throw → 라우트가 502+error 로 응답해 "일시 오류" 구분
  if (!res.ok) throw new Error(`vworld_http_${res.status}`);
  const data = await res.json().catch(() => null);
  return data?.response?.result?.items ?? [];
}

// 주소·지번·지명 통합 검색 → 좌표 반환 (엉뚱한 지역 방지: 관련도 필터)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!KEY || !q) return NextResponse.json({ items: [] });

  // 검색어 토큰 (시/군/구/읍/면/동/리 명) — 2글자 이상
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  const addrOf = (it: any) => it.address?.parcel || it.address?.road || it.title || '';
  const score = (addr: string) => tokens.filter((t) => addr.includes(t)).length;
  // 검색어가 여러 토큰이면 최소 2개(또는 토큰 수) 일치 요구 — 1개만 겹치는 타지역 결과 차단
  const minScore = Math.min(2, tokens.length);

  // 끝의 지목 글자(전/답/임 등) 떼낸 버전도 후보
  const stripped = q.replace(/(\d)\s*[가-힣]$/, '$1');
  const candidates = stripped !== q ? [q, stripped] : [q];

  try {
    let raw: any[] = [];
    let kind = 'parcel';
    for (const cand of candidates) {
      raw = await vsearch(cand, 'address', 'parcel');
      if (raw.length) { kind = 'parcel'; break; }
    }
    if (!raw.length) {
      for (const cand of candidates) {
        raw = await vsearch(cand, 'address', 'road');
        if (raw.length) { kind = 'road'; break; }
      }
    }
    if (!raw.length) { raw = await vsearch(q, 'place', ''); kind = 'place'; }

    const items: GeoItem[] = raw
      .map((it: any) => {
        const address = addrOf(it);
        return {
          title: it.title ?? address,
          address,
          lat: parseFloat(it.point?.y),
          lng: parseFloat(it.point?.x),
          kind,
          score: score(address),
        };
      })
      .filter((m: GeoItem) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
      // 관련도 필터: 검색어 지역명과 충분히 일치하는 것만 (타지역 동명 차단)
      .filter((m: GeoItem) => m.score >= minScore)
      // 관련도 높은 순
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message }, { status: 502 });
  }
}
