import { NextRequest, NextResponse } from 'next/server';

const KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY ?? '';

// VWorld WFS(연속지적도) 프록시 — CORS 회피 + 재시도 + 필지/지번 반환
export async function GET(req: NextRequest) {
  const bbox = req.nextUrl.searchParams.get('bbox'); // "minLat,minLng,maxLat,maxLng"
  if (!KEY || !bbox) return NextResponse.json({ type: 'FeatureCollection', features: [] });

  const url =
    `https://api.vworld.kr/req/wfs?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0` +
    `&TYPENAME=lp_pa_cbnd_bubun&BBOX=${bbox}&SRSNAME=EPSG:4326` +
    `&OUTPUT=application/json&KEY=${KEY}&DOMAIN=http://localhost:3000&count=300`;

  let lastStatus = 0;
  let lastErr = '';
  // VWorld가 간헐적으로 502를 주므로 최대 3회 재시도
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      lastStatus = res.status;
      const text = await res.text();
      if (res.ok) {
        try {
          return NextResponse.json(JSON.parse(text));
        } catch {
          lastErr = text.slice(0, 120); // JSON 아님 (XML 오류 등)
        }
      } else {
        lastErr = `upstream ${res.status}`;
      }
    } catch (e: any) {
      lastErr = e?.message ?? 'fetch error';
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  // 모두 실패 — 200으로 반환하되 오류 정보 포함 (클라이언트가 안내)
  return NextResponse.json({
    type: 'FeatureCollection',
    features: [],
    upstreamStatus: lastStatus,
    error: lastErr,
  });
}
