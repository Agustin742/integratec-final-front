import { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { GradingForm, type GradingConfirmedMeta } from './grading-form';
import { gradingMessages } from './grading-messages';
import type { GradeResponseDto, GradingQueueItemDto } from './grading-schema';
import { SubmissionViewer } from './submission-viewer';

const messages = gradingMessages.dialog;

export interface GradingReviewDialogProps {
  readonly open: boolean;
  readonly classroomId: string;
  readonly userId: string;
  readonly submission: GradingQueueItemDto | null;
  readonly maxScore?: number;
  readonly activityFormat?: 'FILE' | 'MULTIPLE_CHOICE';
  readonly schoolTimeZone: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onGraded: (
    grade: GradeResponseDto,
    meta: GradingConfirmedMeta,
  ) => void;
  readonly onReconcileRequired: () => void;
  readonly getTriggerElement?: () => HTMLElement | null;
  readonly fallbackFocus?: () => HTMLElement | null;
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

export function GradingReviewDialog({
  open,
  classroomId,
  userId,
  submission,
  maxScore,
  activityFormat,
  schoolTimeZone,
  onOpenChange,
  onGraded,
  onReconcileRequired,
  getTriggerElement,
  fallbackFocus,
}: GradingReviewDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  useEffect(() => {
    return () => {
      setSubmitting(false);
    };
  }, []);

  const handleSubmittingChange = useCallback((next: boolean) => {
    setSubmitting(next);
  }, []);

  const handleDirtyChange = useCallback((next: boolean) => {
    setIsDirty(next);
    if (!next) {
      setConfirmingDiscard(false);
    }
  }, []);

  const handleOpenChange = (nextOpen: boolean): void => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (submitting) {
      return;
    }
    if (isDirty && !confirmingDiscard) {
      setConfirmingDiscard(true);
      return;
    }
    setConfirmingDiscard(false);
    onOpenChange(false);
  };

  if (!submission) {
    return null;
  }

  const isRegrade = submission.grade !== null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        onEscapeKeyDown={(event) => {
          if (submitting) {
            event.preventDefault();
          } else if (isDirty && !confirmingDiscard) {
            event.preventDefault();
            setConfirmingDiscard(true);
          }
        }}
        onPointerDownOutside={(event) => {
          if (submitting) {
            event.preventDefault();
          } else if (isDirty && !confirmingDiscard) {
            event.preventDefault();
            setConfirmingDiscard(true);
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!focusIfUsable(getTriggerElement?.())) {
            focusIfUsable(fallbackFocus?.());
          }
        }}
      >
        <div className="space-y-5">
          <div className="space-y-1 pr-8">
            <DialogTitle>
              {isRegrade ? messages.titleRegrade : messages.titleGrade}
            </DialogTitle>
            <DialogDescription>
              {messages.description(
                submission.studentDisplayName,
                submission.activityTitle,
              )}
            </DialogDescription>
          </div>

          {confirmingDiscard ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription className="space-y-3">
                <p>{messages.unsavedConfirm}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setConfirmingDiscard(false)}
                  >
                    {messages.keepEditing}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="min-h-11"
                    onClick={() => {
                      setConfirmingDiscard(false);
                      onOpenChange(false);
                    }}
                  >
                    {messages.discardAndClose}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <SubmissionViewer
            classroomId={classroomId}
            userId={userId}
            submission={submission}
            activityFormat={activityFormat}
            schoolTimeZone={schoolTimeZone}
            onNotFound={onReconcileRequired}
          />

          <GradingForm
            key={submission.id}
            submission={submission}
            maxScore={maxScore}
            activityFormat={activityFormat}
            schoolTimeZone={schoolTimeZone}
            onGraded={onGraded}
            onReconcileRequired={onReconcileRequired}
            onSubmittingChange={handleSubmittingChange}
            onDirtyChange={handleDirtyChange}
          />

          <div className="flex justify-end border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={submitting}
              onClick={() => handleOpenChange(false)}
            >
              {messages.close}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
