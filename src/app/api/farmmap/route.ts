import { NextRequest, NextResponse } from 'next/server';

const MAFRA_KEY = process.env.MAFRA_API_KEY ?? process.env.NEXT_PUBLIC_MAFRA_API_KEY ?? '';

// WGS84(위경도) → EPSG:5179 (Korea 2000 / Unified CS, TM)
function wgs84To5179(lat: number, lon: number): [number, number] {
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const k0 = 0.9996;
  const lat0 = (38.0 * Math.PI) / 180;
  const lon0 = (127.5 * Math.PI) / 180;
  const x0 = 1000000.0, y0 = 2000000.0;
  const phi = (lat * Math.PI) / 180;
  const lam = (lon * Math.PI) / 180;
  const Mof = (ph: number) =>
    a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * ph
      - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * ph)
      + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * ph)
      - ((35 * e2 ** 3) / 3072) * Math.sin(6 * ph));
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2;
  const C = ep2 * Math.cos(phi) ** 2;
  const A = (lam - lon0) * Math.cos(phi);
  const M = Mof(phi), M0 = Mof(lat0);
  const x = x0 + k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120);
  const y = y0 + k0 * (M - M0 + N * Math.tan(phi) * (A ** 2 / 2 + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 + ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720));
  return [x, y];
}

// 팜맵(농경지 전자지도) 영역 조회 프록시 — 실제 경작 분류(논/밭/과수/시설) 반환
export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '');
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '');
  const radius = Math.min(1000, parseInt(req.nextUrl.searchParams.get('radius') ?? '800', 10) || 800);
  if (!MAFRA_KEY) return NextResponse.json({ parcels: [], error: 'MAFRA_API_KEY 미설정' });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ parcels: [] });

  const [x, y] = wgs84To5179(lat, lng);
  const url =
    `http://apis.data.go.kr/B552895/getFarmmapService/getAreaBasedFarmmapInfo?serviceKey=${MAFRA_KEY}` +
    `&numOfRows=300&pageNo=1&type=json&positionX=${x}&positionY=${y}&radius=${radius}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { return NextResponse.json({ parcels: [], error: text.slice(0, 300) }); }

    // 디버그: 원본 응답 구조 그대로 반환
    if (req.nextUrl.searchParams.get('debug') === '1') {
      return NextResponse.json({ _raw: data, _x: x, _y: y });
    }

    const body = data?.response?.body;
    let items = body?.items?.item ?? body?.items ?? [];
    if (!Array.isArray(items)) items = items ? [items] : [];
    const parcels = items.map((it: any) => ({
      pnu: String(it.pnuLnmCd ?? ''),
      intprNm: String(it.intprNm ?? ''),   // 논/밭/과수/시설/기타
      intprCd: String(it.intprCd ?? ''),
      lnm: String(it.lnm ?? ''),
      vdptYr: String(it.vdptYr ?? ''),
    }));
    return NextResponse.json({
      parcels,
      count: parcels.length,
      totalCount: body?.totalCount,
      resultMsg: data?.response?.header?.resultMsg,
    });
  } catch (e: any) {
    return NextResponse.json({ parcels: [], error: e?.message }, { status: 502 });
  }
}
