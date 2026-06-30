import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { QueryProvider } from '@/components/shared/QueryProvider';
import { Toaster } from '@/components/ui/sonner';

const kblCourt = localFont({
  src: '../../public/fonts/KBL_court/KBLCourt_EB.otf',
  variable: '--font-kbl-court',
  display: 'swap',
  weight: '800',
  preload: false,
});

export const metadata: Metadata = {
  title: '팜유 | 조합원 성과관리 AI 플랫폼',
  description: '조합원 운영성과 통합 분석·출하 의사결정·경축 적합도 AI 플랫폼',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={kblCourt.variable} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
      </head>
      <body suppressHydrationWarning>
        <QueryProvider>
          {children}
          <Toaster richColors position="top-right" />
        </QueryProvider>
      </body>
    </html>
  );
}
