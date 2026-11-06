import type { CSSProperties, ReactElement } from 'react';
import { Toaster as Sonner, toast, type ToasterProps } from 'sonner';
import { cn } from '@/lib/utils';
import { uiMessages } from './ui-messages';

export { toast };

const toastStyle: CSSProperties & Record<`--${string}`, string> = {
  '--normal-bg': 'var(--popover)',
  '--normal-text': 'var(--popover-foreground)',
  '--normal-border': 'var(--edge)',
};

// Sonner's visual layer is disabled (unstyled) so the toast speaks the same
// clay-panel / resin-key language as the rest of the kit. Sonner still owns
// positioning, stacking, swipe and enter/exit motion.
const toastClassNames = {
  toast: cn(
    'group/toast flex w-(--width) items-start gap-3 rounded-2xl border border-edge',
    'bg-popover p-4 pr-3 font-sans text-popover-foreground shadow-float',
  ),
  content: 'flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5',
  title: 'font-display text-base leading-snug font-semibold text-balance',
  description: 'text-small leading-snug text-muted-foreground',
  // Round icon chip, matching the Alert chip.
  icon: cn(
    'flex size-8 shrink-0 items-center justify-center rounded-full',
    'bg-primary text-primary-foreground shadow-[0_2px_0_var(--key-primary)]',
    '[&_svg]:size-4',
  ),
  success: 'border-success-edge!',
  info: 'border-info-edge! [&_[data-icon]]:bg-info-foreground [&_[data-icon]]:shadow-[0_2px_0_#0f3a38]',
  warning:
    'border-warning-edge! [&_[data-icon]]:bg-warning-foreground [&_[data-icon]]:shadow-[0_2px_0_#3d3006]',
  error:
    'border-danger-edge! bg-danger! text-danger-foreground! [&_[data-description]]:text-danger-foreground [&_[data-icon]]:bg-danger-foreground [&_[data-icon]]:shadow-[0_2px_0_var(--key-destructive)]',
  // Small ghost key inside the panel, after the content.
  closeButton: cn(
    'key-bevel motion-press order-last ml-1 inline-flex size-8 shrink-0 items-center justify-center',
    'rounded-lg border border-edge bg-card text-muted-foreground hover:text-foreground',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
    '[&_svg]:size-3.5',
  ),
  actionButton:
    'key-bevel motion-press rounded-lg bg-primary px-3 py-1.5 font-display text-small font-semibold text-primary-foreground',
  cancelButton:
    'rounded-lg bg-secondary px-3 py-1.5 font-display text-small font-semibold text-secondary-foreground',
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
      gap={12}
      {...props}
      theme="light"
      richColors={false}
      customAriaLabel={uiMessages.notifications}
      className={cn('font-sans', className)}
      style={{ ...toastStyle, ...style }}
      toastOptions={{
        ...toastOptions,
        unstyled: true,
        closeButtonAriaLabel: uiMessages.closeNotification,
        classNames: {
          ...toastClassNames,
          ...toastOptions?.classNames,
        },
      }}
    />
  );
}
