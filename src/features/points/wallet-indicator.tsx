import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { pointsMessages } from './messages';
import { useStudentWallet } from './use-student-wallet';
import { WalletPanel } from './wallet-panel';

const messages = pointsMessages.wallet;

export interface WalletIndicatorProps {
  readonly classroomId: string;
}

/**
 * Reusable student points balance chip for the workspace header (#45,
 * HU-GAM-001). Shows only the signed-in student's server-computed balance:
 * pending while loading, unavailable on failure (never zero), and the
 * confirmed balance otherwise. The mount point decides whether to render it;
 * no role gating happens here. Opening the dialog shows the wallet panel;
 * Radix returns focus to this trigger on close.
 */
export function WalletIndicator({ classroomId }: WalletIndicatorProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wallet = useStudentWallet(classroomId);

  const statusText =
    wallet.status === 'ready'
      ? messages.indicator.ready(wallet.wallet.balance)
      : wallet.status === 'error'
        ? messages.indicator.unavailable
        : messages.indicator.pending;

  // The visible text carries the state; the accessible name also names the
  // action so screen-reader users hear what the control does.
  const accessibleName = messages.indicator.accessibleName(statusText);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        aria-label={accessibleName}
        onClick={() => setOpen(true)}
      >
        {statusText}
      </Button>
      {open && (
        <DialogContent
          className="max-h-[calc(100%-2rem)] [overflow-wrap:anywhere]"
          onCloseAutoFocus={(event) => {
            // Close must land focus back on the trigger button.
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <DialogTitle>{messages.panel.title}</DialogTitle>
          <DialogDescription>{messages.panel.description}</DialogDescription>
          <WalletPanel classroomId={classroomId} />
        </DialogContent>
      )}
    </Dialog>
  );
}
