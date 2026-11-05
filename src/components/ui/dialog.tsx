import type { ComponentProps, ReactElement } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '../../lib/utils';
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
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/35" />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-popover p-6 pt-14 text-popover-foreground shadow-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={uiMessages.close}
          className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-md border border-border bg-popover text-popover-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
      className={cn('text-xl font-semibold', className)}
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
