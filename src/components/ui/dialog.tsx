import type { ComponentProps, ReactElement } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';
import { uiMessages } from './ui-messages';

export function Dialog(
  props: Omit<ComponentProps<typeof DialogPrimitive.Root>, 'modal'>,
): ReactElement {
  return <DialogPrimitive.Root {...props} modal />;
}

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>): ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/45 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-edge bg-popover p-7 pt-16 text-popover-foreground shadow-float data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={uiMessages.close}
          className="key-bevel motion-press absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-xl bg-secondary font-display text-xl leading-none text-secondary-foreground [--key:var(--key-secondary)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
        >
          <span aria-hidden="true">×</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>): ReactElement {
  return (
    <DialogPrimitive.Title
      className={cn('font-display text-2xl font-semibold', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>): ReactElement {
  return (
    <DialogPrimitive.Description
      className={cn('mt-2 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}
