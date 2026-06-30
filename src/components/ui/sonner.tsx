'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      style={
        {
          '--normal-bg': '#07221B',
          '--normal-text': '#ffffff',
          '--normal-border': 'transparent',
          '--success-bg': '#07221B',
          '--success-text': '#ffffff',
          '--success-border': 'transparent',
          '--error-bg': '#3b0d0d',
          '--error-text': '#ffffff',
          '--error-border': 'transparent',
          '--warning-bg': '#2d1f00',
          '--warning-text': '#ffffff',
          '--warning-border': 'transparent',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
