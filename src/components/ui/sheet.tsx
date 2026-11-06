import type { ComponentProps, ReactElement } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './dialog';

export const Sheet = Dialog;
export const SheetTrigger = DialogTrigger;
export const SheetClose = DialogClose;
export const SheetTitle = DialogTitle;
export const SheetDescription = DialogDescription;

export function SheetContent({
  side = 'right',
  className,
  ...props
}: ComponentProps<typeof DialogContent> & {
  side?: 'left' | 'right';
}): ReactElement {
  return (
    <DialogContent
      className={cn(
        'top-0 h-dvh max-h-dvh w-[min(90vw,24rem)] max-w-none translate-x-0 translate-y-0 rounded-none',
        side === 'right'
          ? 'right-0 left-auto rounded-l-3xl data-[state=closed]:animate-sheet-right-out data-[state=open]:animate-sheet-right-in'
          : 'left-0 rounded-r-3xl data-[state=closed]:animate-sheet-left-out data-[state=open]:animate-sheet-left-in',
        className,
      )}
      {...props}
    />
  );
}
