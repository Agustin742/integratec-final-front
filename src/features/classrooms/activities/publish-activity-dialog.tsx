import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatInstant } from '@/lib/dates';
import { useSessionService } from '@/session/provider';
import { classroomMessages } from '../messages';
import {
  isAbortError,
  isUncertainWriteError,
  publishClassroomActivity,
} from './activity-service';
import type { TeacherActivityResponseDto } from './activity-schema';

const messages = classroomMessages.activities.editor.publish;

/** Minimal target shape the publish confirmation needs (summary or detail). */
export interface PublishActivityTarget {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string;
  readonly state: 'DRAFT' | 'PUBLISHED';
  readonly timeZone: string;
}

export interface PublishActivityDialogProps {
  readonly open: boolean;
  readonly classroomId: string;
  readonly target: PublishActivityTarget | null;
  readonly onOpenChange: (open: boolean) => void;
  /** Server-confirmed publish; the panel reconciles and announces. */
  readonly onPublished: (activity: TeacherActivityResponseDto) => void;
  /** 403/404/uncertain outcomes: reconcile the list before retrying. */
  readonly onReconcileRequired: () => void;
  readonly getTriggerElement?: () => HTMLElement | null;
  readonly fallbackFocus: () => HTMLElement | null;
}

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

/**
 * Publish confirmation (`HU-ACT-001`): states that publishing is one-way
 * (DRAFT -> PUBLISHED), that students will see the activity, and that `dueAt`
 * must be in the future. Pending, confirmed-failure (`400`/`409`, translated by
 * the service), and outcome-uncertain states are distinct; uncertain failures
 * keep the confirmation open and reconcile the list.
 */
export function PublishActivityDialog({
  open,
  classroomId,
  target,
  onOpenChange,
  onPublished,
  onReconcileRequired,
  getTriggerElement,
  fallbackFocus,
}: PublishActivityDialogProps) {
  const { client } = useSessionService();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const isPublishingRef = useRef(false);
  const succeededRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Transient state (`error`, `succeededRef`) is reset by remounting the
  // dialog per target: the panel keys it by the publish target id.

  const handleOpenChange = (nextOpen: boolean): void => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (isPublishingRef.current) {
      return;
    }
    onOpenChange(false);
  };

  const handleConfirmPublish = async (): Promise<void> => {
    if (
      isPublishingRef.current ||
      target === null ||
      target.state !== 'DRAFT'
    ) {
      return;
    }

    isPublishingRef.current = true;
    setPublishing(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;

    try {
      const published = await publishClassroomActivity(
        client,
        classroomId,
        target.id,
        { signal: controller.signal },
      );

      if (!isMountedRef.current || controller.signal.aborted) {
        return;
      }

      setError(null);
      isPublishingRef.current = false;
      // The confirmed publish removes the per-item "Publicar" trigger, so the
      // close returns focus to the panel heading instead of a removed button.
      succeededRef.current = true;
      onPublished(published);
    } catch (caughtError) {
      if (
        isAbortError(caughtError) ||
        controller.signal.aborted ||
        !isMountedRef.current
      ) {
        return;
      }

      const errorMessage =
        caughtError instanceof ApiError
          ? caughtError.userMessage
          : classroomMessages.activities.write.uncertain;
      setError(errorMessage);

      if (isUncertainWriteError(caughtError)) {
        // The write outcome is unknown: reconcile the list instead of
        // offering a blind retry that could duplicate effects.
        onReconcileRequired();
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      isPublishingRef.current = false;
      if (isMountedRef.current) {
        setPublishing(false);
      }
    }
  };

  if (!open || target === null) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (isPublishingRef.current) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (isPublishingRef.current) {
            event.preventDefault();
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!succeededRef.current && focusIfUsable(getTriggerElement?.())) {
            return;
          }
          focusIfUsable(fallbackFocus());
        }}
      >
        <DialogTitle>{messages.title(target.title)}</DialogTitle>
        <DialogDescription>
          {messages.description} {messages.dueAtLabel}:{' '}
          {formatInstant(target.dueAt, { timeZone: target.timeZone })} (
          {target.timeZone}).
        </DialogDescription>

        {error !== null && (
          <Alert variant="destructive" role="alert" className="mt-4">
            <AlertTitle>{messages.errorTitle}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={publishing}
            onClick={() => handleOpenChange(false)}
          >
            {messages.cancel}
          </Button>
          <Button
            type="button"
            busy={publishing}
            onClick={() => void handleConfirmPublish()}
          >
            {publishing ? messages.pending : messages.submit}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
