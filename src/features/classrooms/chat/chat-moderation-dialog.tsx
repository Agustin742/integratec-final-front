import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import { classroomDetailQueryKey } from '@/api/query-keys';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useSessionService } from '@/session/provider';
import { classroomMessages as messages } from '../messages';
import type { ChatHistoryMessageDto } from './chat-schema';
import {
  hideClassroomChatMessage,
  isAbortError,
  isUncertainChatWriteError,
} from './chat-service';

function focusIfUsable(element: HTMLElement | null | undefined): boolean {
  if (
    !element?.isConnected ||
    element.closest('[hidden], [inert], [aria-hidden="true"]') ||
    element.matches(':disabled, [aria-disabled="true"]')
  ) {
    return false;
  }
  element.focus();
  return document.activeElement === element;
}

export interface ChatModerationDialogProps {
  readonly open: boolean;
  /** Row chosen for moderation (click-time snapshot; the id is what is sent). */
  readonly message: ChatHistoryMessageDto | null;
  readonly classroomId: string;
  readonly userId: string;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * Revalidates every chat query of this user and classroom and resolves to
   * the fresh row, so the dialog decides outcomes from server truth.
   */
  readonly onReconcile: (
    messageId: string,
  ) => Promise<ChatHistoryMessageDto | null>;
  readonly getTriggerElement?: () => HTMLElement | null;
  readonly fallbackFocus?: () => HTMLElement | null;
}

/**
 * Teacher-level moderation confirmation (`HU-COM-002`, issue #51, S3/S10).
 *
 * `DELETE /classrooms/{id}/messages/{messageId}` (`ChatController_hide`) is a
 * logical, idempotent staff-only moderation: the server records the
 * `hiddenAt`/`hiddenById` audit and never deletes the row. No unhide exists,
 * so the confirmation is deliberately final and shows the exact message.
 *
 * Outcomes (`rules/communication-and-notifications.md`, Moderation UI):
 * - pending: the controls are disabled and nothing is faked before the `204`;
 * - confirmed: the history is reconciled first, so the closed dialog leaves
 *   the row hidden with its audit (`rules/error-handling-and-feedback.md`);
 * - denied: the failure copy is shown, the dialog closes and the classroom
 *   context is revalidated so a lost permission removes the control;
 * - uncertain (transport loss): reconcile against the revalidated history
 *   instead of a blind retry; a hide that did not land stays retryable.
 */
export function ChatModerationDialog({
  open,
  message,
  classroomId,
  userId,
  onOpenChange,
  onReconcile,
  getTriggerElement,
  fallbackFocus,
}: ChatModerationDialogProps) {
  const copy = messages.chat.moderation;
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [uncertainNotice, setUncertainNotice] = useState(false);

  const isMountedRef = useRef(true);
  const submittingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      submittingRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  if (message === null) {
    return null;
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (submittingRef.current) {
      return;
    }
    setUncertainNotice(false);
    onOpenChange(false);
  };

  const resolveUncertain = async (): Promise<void> => {
    // Never blind-retry: reconcile the moderated row against the server
    // first and let the revalidated history decide the outcome.
    const reconciled = await onReconcile(message.id);
    if (!isMountedRef.current) {
      return;
    }
    if (reconciled !== null && reconciled.hiddenAt !== null) {
      toast.success(copy.uncertainReconciledToast);
      onOpenChange(false);
      return;
    }
    // The hide could not be confirmed: report the uncertainty and keep the
    // dialog open for one user-initiated retry (the endpoint is idempotent).
    setUncertainNotice(true);
  };

  const handleConfirm = async (): Promise<void> => {
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setUncertainNotice(false);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await hideClassroomChatMessage(client, classroomId, message.id, {
        signal: controller.signal,
      });
      if (!isMountedRef.current) {
        return;
      }
      // Definite `204`: reconcile before closing so the row is already the
      // server-confirmed hidden state with its moderation audit.
      await onReconcile(message.id);
      if (!isMountedRef.current) {
        return;
      }
      toast.success(copy.confirmedToast);
      onOpenChange(false);
    } catch (error) {
      if (isAbortError(error) || !isMountedRef.current) {
        return;
      }

      if (isUncertainChatWriteError(error) || !(error instanceof ApiError)) {
        await resolveUncertain();
        return;
      }

      // Definite server denial (401/403/404/429): show the failure copy and
      // close without faking the moderation. A lost permission also
      // reconciles the classroom context so the control disappears.
      if (error.status === 403 || error.status === 404) {
        void queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, classroomId),
          exact: true,
        });
      }
      toast.error(copy.deniedToastTitle, { description: error.userMessage });
      onOpenChange(false);
    } finally {
      submittingRef.current = false;
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-lg"
        onEscapeKeyDown={(event) => {
          if (submittingRef.current) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (submittingRef.current) {
            event.preventDefault();
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // The row control is gone once its message is hidden server-side,
          // so focus falls back to the history list.
          if (!focusIfUsable(getTriggerElement?.())) {
            focusIfUsable(fallbackFocus?.());
          }
        }}
      >
        <div className="space-y-4">
          <div className="space-y-1 pr-8">
            <DialogTitle>{copy.dialogTitle}</DialogTitle>
            <DialogDescription>{copy.dialogDescription}</DialogDescription>
          </div>

          <blockquote className="space-y-1 rounded-xl border border-edge bg-surface-subtle/60 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {copy.messageLabel}
            </p>
            {/* Strict plain text node rendering (never dangerouslySetInnerHTML). */}
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {message.body}
            </p>
          </blockquote>

          {submitting ? (
            <Alert role="status">
              <AlertDescription>{copy.pendingNotice}</AlertDescription>
            </Alert>
          ) : null}

          {uncertainNotice ? (
            <Alert role="status">
              <AlertTitle as="h4">{copy.uncertainTitle}</AlertTitle>
              <AlertDescription>{copy.uncertainBody}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={submitting}
              onClick={() => handleOpenChange(false)}
            >
              {copy.cancelAction}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={submitting}
              onClick={() => {
                void handleConfirm();
              }}
            >
              {submitting ? copy.confirmingAction : copy.confirmAction}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
