'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LandingFooter } from '@/components/landing/LandingFooter';
import Image from 'next/image';
import clsx from 'clsx';
import { toast } from 'sonner';

const POINTS: Array<[string, string, string]> = [
  ['01', '공공데이터 통합', '농업·기상·가격 공공데이터와 조합 내부 데이터를 표준화해 한 곳에 연결합니다.'],
  ['02', 'AI 운영 인사이트', '조합원 성과 그룹, 위험 알림, 출하 적기 추천을 자동으로 도출합니다.'],
  ['03', '리포트 자동화', '월간 운영 리포트와 조합원 액션플랜을 한 번의 클릭으로 생성합니다.'],
];

const STEPS: Array<[string, string, string, string]> = [
  ['01', 'Ingest', '데이터 수집', '공공데이터·농협 ERP·조합 엑셀까지, 흩어진 데이터 소스를 표준 커넥터로 자동 수집합니다.'],
  ['02', 'Normalize', '통합·정제', '결측·이상치 처리와 표준 스키마 변환으로 분석 가능한 형태로 다듬어 둡니다.'],
  ['03', 'Analyze', 'AI 분석', '조합원 성과 그룹·위험 알림·경축 적합도를 모델이 자동으로 계산합니다.'],
  ['04', 'Decide', '의사결정 추천', '가격·재고·기상 신호를 종합해 출하·보류·분할출하 권고를 제시합니다.'],
  ['05', 'Deliver', '리포트 출력', '월간 운영 리포트와 조합원 액션플랜을 PDF로 자동 생성해 전달합니다.'],
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [form, setForm] = useState({ union: '', name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);

  const setField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    const tid = toast.loading('문의를 전송 중…');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, kind: 'onboarding' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? '전송 실패');
      toast.success('도입 문의가 접수되었습니다. 빠르게 연락드리겠습니다.', { id: tid });
      setForm({ union: '', name: '', email: '', message: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '전송에 실패했습니다. 잠시 후 다시 시도해주세요.', { id: tid });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.85);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="bg-bg-cream text-fg text-base leading-relaxed">
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-20 backdrop-blur-md transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.06)',
          borderBottom: scrolled ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.18)',
        }}
      >
        <div
          className="max-w-295 mx-auto px-7 py-3.5 grid grid-cols-[1fr_auto_1fr] items-center gap-6"
          style={{ color: scrolled ? '#1a1d1a' : '#f0f0f0' }}
        >
          <Link
            href="/"
            className="flex items-center gap-2.5"
          >
            <Image
              src="/images/logo.png"
              alt="팜유 로고"
              width={40}
              height={40}
              priority
              className="w-10 h-10"
            />
            <span
              className="text-2xl tracking-tight leading-none text-[#397359]"
              style={{ fontFamily: 'var(--font-kbl-court)', letterSpacing: '-0.02em' }}
            >
              팜유
            </span>
          </Link>
          <nav className="flex gap-9 justify-center">
            {[['#intro', '서비스 소개'], ['#pipeline', '핵심 기능'], ['#contact', '도입 문의']].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-[15px] font-semibold opacity-90 hover:opacity-100"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex justify-end gap-3">
            <Link
              href="/login"
              className="inline-flex items-center px-4 py-2.5 rounded-[10px] text-sm font-semibold hover:bg-white/15"
            >
              로그인
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center px-4 py-2.5 rounded-[10px] text-sm font-semibold"
              style={{ backgroundColor: '#397359', color: '#ffffff' }}
            >
              도입 문의
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen text-white flex items-center overflow-hidden bg-[#1a2a1e]">
        <video
          className="absolute inset-0 w-full h-full object-cover z-0"
          autoPlay muted loop playsInline preload="auto"
        >
          <source src="/video/%EB%A9%94%EC%9D%B8%20%EC%98%81%EC%83%81.mp4" type="video/mp4" />
        </video>
        <div
          aria-hidden
          className="absolute inset-0 z-1"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,12,10,0.42) 0%, rgba(8,10,8,0.6) 100%), linear-gradient(90deg, rgba(8,10,8,0.5) 0%, rgba(8,10,8,0.08) 60%)',
          }}
        />
        <div className="relative z-2 max-w-295 mx-auto w-full px-7 pt-35 pb-25">
          <span className="inline-block px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-white/14 text-[#d8ede4] backdrop-blur-sm mb-5">
            조합원 성과관리 AI 플랫폼
          </span>
          <h1
            className="font-extrabold leading-[1.05] tracking-tight m-0"
            style={{ fontSize: 'clamp(44px, 6vw, 80px)', textShadow: '0 2px 30px rgba(0,0,0,0.3)' }}
          >
            농업 데이터에서<br />
            <strong className="text-[#a8d8c2] font-extrabold">운영판단</strong>이 나오게.
          </h1>
          <p
            className="text-[#ecefe9] mt-6 max-w-160 leading-[1.6]"
            style={{ fontSize: 'clamp(17px, 1.4vw, 20px)' }}
          >
            공공·농협·조합 데이터를 한 줄의 파이프라인으로 흘려 보내면, 매일의 운영판단이 자동으로 나옵니다.
          </p>
          <div className="mt-9 flex gap-3 flex-wrap">
            <a href="#contact" className="inline-flex items-center px-4 py-2.5 rounded-[10px] text-sm font-semibold" style={{ backgroundColor: '#ffffff', color: '#1a1d1a' }}>도입 문의</a>
            <a href="#pipeline" className="inline-flex items-center px-4 py-2.5 rounded-[10px] border border-white/50 text-white text-sm font-semibold hover:bg-white/10">파이프라인 보기</a>
          </div>
        </div>
        <div className="absolute ml-19.5 bottom-7 left-1/2 -translate-x-1/2 text-white/70 text-xs tracking-[0.16em] z-2 animate-[bob_2.4s_ease-in-out_infinite]">
          SCROLL ↓
        </div>
      </section>

      {/* 서비스 소개 */}
      <section id="intro" className="py-30 scroll-mt-18">
        <div className="max-w-295 mx-auto px-7 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div>
            <span className="inline-block px-4 py-1.5 rounded-2xl text-[13px] font-semibold mb-5 backdrop-blur-sm" style={{ backgroundColor: 'rgba(55,115,89,0.12)', color: '#397359', border: '1px solid rgba(55,115,89,0.2)' }}>서비스 소개</span>
            <h2 className="font-bold leading-tight tracking-tight" style={{ fontSize: 'clamp(28px, 3.4vw, 44px)' }}>
              흩어진 농업 데이터를<br />한 화면에서 의사결정으로.
            </h2>
            <p className="text-fg-soft mt-5 leading-[1.6]" style={{ fontSize: 'clamp(17px, 1.4vw, 20px)' }}>
              농협 조합과 조합원이 필요한 데이터는 이미 충분합니다. 다만 흩어져 있을 뿐. 팜유는
              공공·농협·조합 데이터를 한 곳에 모아 분석하고, 출하·경축·운영 단위로 행동가능한 답을 제공합니다.
            </p>
          </div>
          <div className="grid gap-7">
            {POINTS.map(([n, title, desc]) => (
              <div key={n} className="flex gap-4">
                <div className="flex-none w-9.5 h-9.5 rounded-[10px] grid place-items-center font-bold text-white" style={{ backgroundColor: '#397359' }}>
                  {n}
                </div>
                <div>
                  <h3 className="text-[19px] font-bold mb-1">{title}</h3>
                  <p className="text-fg-soft text-[15px]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 핵심 기능 — 중앙선 타임라인 */}
      <section id="pipeline" className="py-30 bg-white border-y border-[#ece9e1] scroll-mt-18">
        <div className="max-w-295 mx-auto px-7">
          <div className="max-w-180 mb-18">
            <span className="inline-block px-4 py-1.5 rounded-2xl text-[13px] font-semibold mb-5 backdrop-blur-sm" style={{ backgroundColor: 'rgba(55,115,89,0.12)', color: '#397359', border: '1px solid rgba(55,115,89,0.2)' }}>핵심 기능</span>
            <h2 className="font-bold leading-tight tracking-tight" style={{ fontSize: 'clamp(28px, 3.4vw, 44px)' }}>
              원본 데이터 → 운영판단까지,<br />한 줄의 파이프라인.
            </h2>
            <p className="text-fg-soft mt-4 leading-[1.6]" style={{ fontSize: 'clamp(17px, 1.4vw, 20px)' }}>
              데이터 수집부터 리포트 출력까지 5단계가 자동으로 흐릅니다.
            </p>
          </div>

          <div className="relative flex flex-col gap-14">
            {/* 중앙선 */}
            <div
              className="absolute top-8 bottom-8 left-1/2 w-0.5 rounded-sm -translate-x-1/2 max-[820px]:left-5.5 max-[820px]:translate-x-0"
              style={{ background: 'linear-gradient(180deg, #397359 0%, #397359 94%, rgba(74,157,87,0.2) 100%)' }}
            />
            {STEPS.map(([n, tag, title, desc], i) => (
              <article
                key={n}
                className="
                  relative grid grid-cols-2 gap-x-25 items-center
                  max-[820px]:grid-cols-1 max-[820px]:pl-14
                "
              >
                <div
                  className={clsx(
                    'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-2',
                    'w-16 h-16 rounded-full grid place-items-center font-extrabold text-base shadow-[0_6px_18px_rgba(74,157,87,0.18)]',
                    'border-2 border-site',
                    i === 4 ? 'bg-site text-white' : 'bg-white text-site-deep',
                    'max-[820px]:left-5.5 max-[820px]:w-11 max-[820px]:h-11 max-[820px]:text-[13px]'
                  )}
                >
                  {n}
                </div>
                <div
                  className={clsx(
                    'bg-white border border-[#ece9e1] rounded-2xl p-7 flex flex-col gap-3.5',
                    i % 2 === 0 ? 'col-start-1' : 'col-start-2',
                    'max-[820px]:col-start-1!'
                  )}
                >
                  <span className="w-fit px-2.5 py-0.5 rounded-xl text-[11px] font-bold tracking-wider uppercase backdrop-blur-sm" style={{ backgroundColor: 'rgba(55,115,89,0.1)', color: '#397359', border: '1px solid rgba(55,115,89,0.18)' }}>{tag}</span>
                  <h3 className="text-[21px] leading-tight font-bold">{title}</h3>
                  <p className="text-[14.5px] text-fg-soft leading-[1.6] m-0">{desc}</p>
                  <div className="bg-[#f4f1e9] border border-dashed border-border-strong rounded-xl aspect-16/10 flex items-center justify-center text-fg-muted text-[13px] p-4 mt-1">
                    [이미지 자리]
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 도입 문의 */}
      <section
        id="contact"
        className="py-35 pb-30 scroll-mt-18"
        style={{
          background:
            'radial-gradient(ellipse at 20% 0%, rgba(74,157,87,0.08), transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(74,157,87,0.06), transparent 50%), #fbfaf6',
        }}
      >
        <div className="max-w-295 mx-auto px-7">
          <div className="bg-white border border-[#ece9e1] rounded-3xl p-16 max-[900px]:p-12 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-14 items-center shadow-[0_24px_60px_rgba(20,30,22,0.06)]">
            <div>
              <span className="inline-block px-4 py-1.5 rounded-2xl text-[13px] font-semibold mb-5 backdrop-blur-sm" style={{ backgroundColor: 'rgba(55,115,89,0.12)', color: '#397359', border: '1px solid rgba(55,115,89,0.2)' }}>도입 문의</span>
              <h2 className="font-bold leading-tight tracking-tight" style={{ fontSize: 'clamp(28px, 3.4vw, 44px)' }}>
                먼저 보여드리고,<br />함께 결정하시면 됩니다.
              </h2>
              <p className="text-fg-soft mt-4 text-[17px] leading-[1.6]">30분 상담으로 조합 데이터에 어떻게 적용되는지 직접 확인해 보세요.</p>
              <ul className="mt-7 grid gap-3.5 p-0 list-none">
                {['조합 데이터 샘플을 활용한 1:1 시연', '예상 도입 일정·요금 안내', '비용 부담 없는 PoC 제안'].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-[14.5px] text-fg-soft">
                    <span className="w-5.5 h-5.5 rounded-full bg-site-soft text-site-deep grid place-items-center text-[13px] font-extrabold">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <form className="grid gap-3" onSubmit={submitInquiry}>
              {([
                ['조합명 · 소속', 'union', 'text', '예) 합천농업법인회사 경제사업소', false],
                ['담당자 성함', 'name', 'text', '이름을 입력해주세요', true],
                ['이메일', 'email', 'email', 'name@example.com', true],
              ] as Array<[string, keyof typeof form, string, string, boolean]>).map(([label, key, type, ph, req]) => (
                <div key={key}>
                  <label className="text-[12.5px] font-semibold text-fg-soft block mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={setField(key)}
                    placeholder={ph}
                    required={req}
                    className="w-full px-4 py-3.5 rounded-[10px] border border-[#ece9e1] bg-white text-[14.5px] focus:outline-none focus:border-site focus:ring-3 focus:ring-site-soft"
                  />
                </div>
              ))}
              <label className="text-[12.5px] font-semibold text-fg-soft block mb-1.5">문의 내용</label>
              <textarea
                value={form.message}
                onChange={setField('message')}
                placeholder="간단한 도입 배경이나 궁금한 점을 적어주세요"
                className="w-full px-4 py-3.5 rounded-[10px] border border-[#ece9e1] bg-white text-[14.5px] min-h-25 resize-y focus:outline-none focus:border-site focus:ring-3 focus:ring-site-soft"
              />
              <button
                type="submit"
                disabled={sending}
                className="bg-site text-white border-none py-3.5 rounded-[10px] font-bold text-[15px] hover:bg-site-deep cursor-pointer mt-1 disabled:opacity-60"
              >
                {sending ? '전송 중…' : '도입 문의 보내기'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer — 5단 풀버전 */}
      <LandingFooter />

    </div>
  );
}
