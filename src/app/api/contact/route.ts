import { NextRequest, NextResponse } from 'next/server';

// 도입 문의 폼 → Resend로 이메일 발송
// 필요한 env (.env.local):
//   RESEND_API_KEY      : Resend API 키 (https://resend.com)
//   CONTACT_TO_EMAIL    : 수신 주소 (미설정 시 아래 기본값)
//   CONTACT_FROM_EMAIL  : 발신 주소 (도메인 인증 전엔 onboarding@resend.dev 사용)
export async function POST(req: NextRequest) {
  let body: { union?: string; name?: string; email?: string; message?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const union = (body.union ?? '').trim();
  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim();
  const message = (body.message ?? '').trim();
  // 랜딩 = 도입 문의(kind:'onboarding'), 로그인 후 사이드바 = 일반 문의
  const isOnboarding = body.kind === 'onboarding';
  const label = isOnboarding ? '도입 문의' : '문의';
  const tag = isOnboarding ? 'FarmU 도입문의' : 'FarmU 문의';

  if (!name || !email) {
    return NextResponse.json({ error: '담당자 성함과 이메일은 필수입니다.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: '이메일 서비스가 아직 설정되지 않았습니다. (RESEND_API_KEY 누락)' },
      { status: 503 },
    );
  }

  const to = process.env.CONTACT_TO_EMAIL ?? 'moon080108@gmail.com';
  const fromEmail = process.env.CONTACT_FROM_EMAIL?.match(/<(.+)>/)?.[1] ?? 'onboarding@resend.dev';
  const from = `${tag} <${fromEmail}>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `[${tag}] ${union || '조합 미기재'} · ${name}`,
        text:
          `■ ${label}가 접수되었습니다\n\n` +
          `조합명·소속: ${union || '-'}\n` +
          `담당자 성함: ${name}\n` +
          `이메일: ${email}\n\n` +
          `■ 문의 내용\n${message || '-'}\n`,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('[contact] Resend 발송 실패:', res.status, detail);
      return NextResponse.json({ error: '메일 발송에 실패했습니다.' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[contact] 발송 오류:', e);
    return NextResponse.json({ error: '메일 발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
