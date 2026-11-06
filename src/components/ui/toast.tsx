import type { CSSProperties, ReactElement } from 'react';
import { Toaster as Sonner, toast, type ToasterProps } from 'sonner';
import { cn } from '@/lib/utils';
import { uiMessages } from './ui-messages';

export { toast };

const toastStyle: CSSProperties & Record<`--${string}`, string> = {
  '--normal-bg': 'var(--popover)',
  '--normal-text': 'var(--popover-foreground)',
  '--normal-border': 'var(--border)',
};

export function Toast({
  className,
  style,
  toastOptions,
  ...props
}: Omit<ToasterProps, 'theme' | 'richColors'>): ReactElement {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      {...props}
      theme="light"
      richColors={false}
      customAriaLabel={uiMessages.notifications}
      className={cn('font-sans', className)}
      style={{ ...toastStyle, ...style }}
      toastOptions={{
        ...toastOptions,
        closeButtonAriaLabel: uiMessages.closeNotification,
        classNames: {
          toast: 'font-sans shadow-float',
          description: 'text-popover-foreground!',
          ...toastOptions?.classNames,
        },
        actionButtonStyle: {
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          ...toastOptions?.actionButtonStyle,
        },
        cancelButtonStyle: {
          background: 'var(--secondary)',
          color: 'var(--secondary-foreground)',
          ...toastOptions?.cancelButtonStyle,
        },
      }}
    />
  );
}
