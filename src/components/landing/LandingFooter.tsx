import Link from 'next/link';
import Image from 'next/image';
import clsx from 'clsx';

export function LandingFooter() {
  return (
    <footer className="border-t border-[#ece9e1] bg-bg-cream text-fg-soft text-sm pt-18 pb-8">
      <div className="max-w-295 mx-auto px-7">
        {/* 브랜드 */}
        <div className="py-10 flex items-center justify-between flex-wrap gap-6">
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-3">
              <Image src="/images/logo.png" alt="팜유" width={30} height={30} className="w-7.5 h-7.5" />
              <span
                className="text-[20px] font-bold text-site-deep"
                style={{ fontFamily: 'var(--font-kbl-court)', letterSpacing: '-0.02em' }}
              >
                팜유
              </span>
            </Link>
            <p className="text-[14px] text-fg-muted max-w-xs leading-relaxed m-0">
              농업 공공데이터 + AI 로 조합 운영의 매일을 가볍게 만드는 플랫폼
            </p>
          </div>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[14px] font-semibold flex-none"
            style={{ backgroundColor: '#397359', color: '#ffffff' }}
          >
            도입 문의하기 →
          </a>
        </div>

        {/* 사업자 정보 */}
        <dl className="border-t border-[#ece9e1] py-6 text-[12.5px] text-fg-muted leading-7 flex flex-wrap gap-y-1.5 gap-x-4.5 m-0">
          <dt className="inline font-semibold text-fg-soft pr-3">(주)팜유</dt>
          <dt className="inline font-semibold text-fg-soft">대표&nbsp;</dt><dd className="inline m-0 mr-4.5">홍길동</dd>
          <dt className="inline font-semibold text-fg-soft">사업자등록번호&nbsp;</dt><dd className="inline m-0 mr-4.5">-</dd>
          <dt className="inline font-semibold text-fg-soft">통신판매업신고&nbsp;</dt><dd className="inline m-0 mr-4.5">-
            
          </dd>
          <dt className="inline font-semibold text-fg-soft">주소&nbsp;</dt><dd className="inline m-0 mr-4.5">경상북도 의성군 봉양면 봉호로 14</dd>
          <dt className="inline font-semibold text-fg-soft">대표전화&nbsp;</dt><dd className="inline m-0 mr-4.5">010-1234-5678</dd>
          <dt className="inline font-semibold text-fg-soft">이메일&nbsp;</dt><dd className="block m-0">moon080108@gmail.com</dd>
        </dl>

        {/* Bottom bar */}
        <div className="border-t border-[#ece9e1] pt-6 flex justify-between items-center gap-4 flex-wrap text-[13px] text-fg-muted">
          <div className="flex gap-4.5">
            <span>COPYRIGHT © 2026 FARMU INC. ALL RIGHTS RESERVED.</span>
            <a href="#" className="text-fg-muted hover:text-site-deep">이용약관</a>
            <a href="#" className={clsx('text-fg-muted hover:text-site-deep', 'font-bold')}>개인정보처리방침</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
