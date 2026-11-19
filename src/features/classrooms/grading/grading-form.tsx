import { useEffect, useMemo, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { ApiError } from '@/api/errors';
import { LiveRegion } from '@/components/feedback/states';
import {
  FormField,
  FormRootError,
  useProtectedSubmit,
  useZodForm,
} from '@/components/forms/form-primitives';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useSessionService } from '@/session/provider';
import { formatActivityDeadline } from '../activities/format-activity-deadline';
import { gradingMessages } from './grading-messages';
import {
  createGradingFormSchema,
  GRADE_LIMITS,
  type GradeResponseDto,
  type GradingFormInput,
  type GradingQueueGradeDto,
  type GradingQueueItemDto,
} from './grading-schema';
import {
  getGradingConflictKind,
  getSubmissionGrade,
  gradeSubmission,
  isAbortError,
  isUncertainGradingWriteError,
  regradeSubmission,
} from './grading-service';

const messages = gradingMessages.form;

export interface ConfirmedGradeSnapshot {
  readonly id: string;
  readonly score: number;
  readonly feedback: string;
  readonly pointsAwarded: number;
  readonly version: number;
  readonly gradedAt: string;
}

export interface GradingConfirmedMeta {
  readonly isRegrade: boolean;
  readonly previousPointsAwarded: number | null;
  readonly wasNoOp: boolean;
}

export interface GradingFormProps {
  readonly submission: GradingQueueItemDto;
  readonly maxScore?: number;
  readonly activityFormat?: 'FILE' | 'MULTIPLE_CHOICE';
  readonly schoolTimeZone: string;
  readonly onGraded: (
    grade: GradeResponseDto,
    meta: GradingConfirmedMeta,
  ) => void;
  readonly onReconcileRequired: () => void;
  readonly onSubmittingChange?: (submitting: boolean) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
}

function toSnapshot(
  grade: GradingQueueGradeDto | GradeResponseDto | null,
): ConfirmedGradeSnapshot | null {
  if (!grade) {
    return null;
  }
  return {
    id: grade.id,
    score: grade.score,
    feedback: grade.feedback,
    pointsAwarded: grade.pointsAwarded,
    version: grade.version,
    gradedAt: grade.gradedAt,
  };
}

export function GradingForm({
  submission,
  maxScore,
  activityFormat,
  schoolTimeZone,
  onGraded,
  onReconcileRequired,
  onSubmittingChange,
  onDirtyChange,
}: GradingFormProps) {
  const { client } = useSessionService();
  const [confirmedGrade, setConfirmedGrade] =
    useState<ConfirmedGradeSnapshot | null>(() => toSnapshot(submission.grade));
  const [versionConflict, setVersionConflict] = useState(false);
  const [isReloadingLatest, setIsReloadingLatest] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      onSubmittingChange?.(false);
    };
  }, [onSubmittingChange]);

  const isRegrade = confirmedGrade !== null;
  const isManualGradingBlocked = activityFormat === 'MULTIPLE_CHOICE';

  const schema = useMemo(
    () =>
      createGradingFormSchema({
        maxScore,
        initialScore: confirmedGrade?.score,
      }),
    [confirmedGrade?.score, maxScore],
  );

  const form = useZodForm<
    GradingFormInput,
    { score: number; feedback: string }
  >({
    schema,
    defaultValues: {
      score: confirmedGrade ? String(confirmedGrade.score) : '',
      feedback: confirmedGrade ? confirmedGrade.feedback : '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const feedbackValue = useWatch({
    control: form.control,
    name: 'feedback',
  });

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  const handleReloadLatestVersion = async (): Promise<void> => {
    if (isReloadingLatest) {
      return;
    }
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsReloadingLatest(true);
    setStatusNotice(null);
    form.clearErrors('root.serverError');
    try {
      const latest = await getSubmissionGrade(client, submission.id, {
        signal: controller.signal,
      });
      if (!isMountedRef.current) {
        return;
      }
      setConfirmedGrade(toSnapshot(latest));
      setVersionConflict(false);
      setStatusNotice(messages.conflictReloadedNotice);
      onReconcileRequired();
    } catch (error) {
      if (isAbortError(error) || !isMountedRef.current) {
        return;
      }
      if (
        error instanceof ApiError &&
        (error.status === 403 || error.status === 404)
      ) {
        onReconcileRequired();
      }
      form.setError('root.serverError', {
        type: 'server',
        message: messages.conflictReloadFailed,
      });
    } finally {
      if (isMountedRef.current) {
        setIsReloadingLatest(false);
      }
    }
  };

  const { isSubmitting, handleSubmit } = useProtectedSubmit(
    form,
    async (values) => {
      if (isManualGradingBlocked) {
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const previousGrade = confirmedGrade;
      const previousVersion = previousGrade?.version ?? 0;
      const previousPoints = previousGrade?.pointsAwarded ?? null;

      setVersionConflict(false);
      setStatusNotice(null);
      onSubmittingChange?.(true);

      try {
        const result = previousGrade
          ? await regradeSubmission(
              client,
              submission.id,
              {
                score: values.score,
                feedback: values.feedback,
                version: previousGrade.version,
              },
              { signal: controller.signal },
            )
          : await gradeSubmission(
              client,
              submission.id,
              {
                score: values.score,
                feedback: values.feedback,
              },
              { signal: controller.signal },
            );

        if (!isMountedRef.current) {
          return;
        }

        const wasNoOp =
          previousGrade !== null && result.version === previousGrade.version;
        const changedPoints =
          previousPoints !== null && result.pointsAwarded !== previousPoints;

        setConfirmedGrade(toSnapshot(result));
        form.reset({
          score: String(result.score),
          feedback: result.feedback,
        });

        const confirmationMessage = wasNoOp
          ? messages.regradeNoOpToast
          : previousGrade !== null
            ? messages.regradeConfirmedToast(
                result.score,
                result.pointsAwarded,
                changedPoints,
              )
            : messages.gradeConfirmedToast(result.score, result.pointsAwarded);

        setAnnouncement(confirmationMessage);
        toast.success(confirmationMessage);
        onGraded(result, {
          isRegrade: previousGrade !== null,
          previousPointsAwarded: previousPoints,
          wasNoOp,
        });
      } catch (error) {
        if (isAbortError(error) || !isMountedRef.current) {
          return;
        }

        const conflictKind = getGradingConflictKind(error);
        if (conflictKind === 'version') {
          setVersionConflict(true);
          onReconcileRequired();
          form.setError('root.serverError', {
            type: 'server',
            message: gradingMessages.errors.conflictVersion,
          });
          return;
        }

        if (conflictKind === 'submission') {
          onReconcileRequired();
          // If initial grading collided because another teacher already graded,
          // fetch the authoritative grade while preserving the teacher's draft.
          if (previousGrade === null) {
            try {
              const serverGrade = await getSubmissionGrade(
                client,
                submission.id,
                { signal: controller.signal },
              );
              if (isMountedRef.current) {
                setConfirmedGrade(toSnapshot(serverGrade));
              }
            } catch {
              // Keep conflict error surface below without masking the root cause.
            }
          }
          throw error;
        }

        if (isUncertainGradingWriteError(error)) {
          onReconcileRequired();
          // Reconcile against the server before claiming failure or inviting a blind retry.
          try {
            const reconciled = await getSubmissionGrade(client, submission.id, {
              signal: controller.signal,
            });
            if (!isMountedRef.current) {
              return;
            }
            if (reconciled.version > previousVersion) {
              setConfirmedGrade(toSnapshot(reconciled));
              form.reset({
                score: String(reconciled.score),
                feedback: reconciled.feedback,
              });
              setStatusNotice(messages.uncertainReconciledGraded);
              onGraded(reconciled, {
                isRegrade: previousGrade !== null,
                previousPointsAwarded: previousPoints,
                wasNoOp: false,
              });
              return;
            }
          } catch (reconcileError) {
            if (isAbortError(reconcileError) || !isMountedRef.current) {
              return;
            }
          }
          if (!isMountedRef.current) {
            return;
          }
          form.setError('root.serverError', {
            type: 'server',
            message: messages.uncertainStillPending,
          });
          return;
        }

        if (
          error instanceof ApiError &&
          (error.status === 403 || error.status === 404)
        ) {
          onReconcileRequired();
        }

        throw error;
      } finally {
        onSubmittingChange?.(false);
      }
    },
    { knownFields: ['score', 'feedback'] },
  );

  const effectiveMaxScore =
    maxScore !== undefined && maxScore < GRADE_LIMITS.maxScore
      ? maxScore
      : GRADE_LIMITS.maxScore;

  return (
    <section
      aria-label={
        isRegrade ? messages.sectionTitleRegrade : messages.sectionTitleGrade
      }
      className="space-y-4"
    >
      <LiveRegion message={announcement} visuallyHidden />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {isRegrade
            ? messages.sectionTitleRegrade
            : messages.sectionTitleGrade}
        </h3>
        {confirmedGrade ? (
          <Badge variant="outline">
            {gradingMessages.panel.versionLabel(confirmedGrade.version)}
          </Badge>
        ) : null}
      </div>

      {confirmedGrade ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface-subtle/60 p-3 text-sm">
            <p className="text-xs font-semibold text-foreground">
              {messages.currentGradeTitle}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="success">
                {gradingMessages.panel.scoreSummary(confirmedGrade.score)}
              </Badge>
              <Badge variant="secondary">
                {gradingMessages.panel.pointsAwardedSummary(
                  confirmedGrade.pointsAwarded,
                )}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {gradingMessages.panel.gradedAtLabel}{' '}
                {formatActivityDeadline(
                  confirmedGrade.gradedAt,
                  schoolTimeZone,
                )}
              </span>
            </div>
            <p className="mt-2 break-words text-xs text-muted-foreground">
              {confirmedGrade.feedback}
            </p>
          </div>

          <Alert>
            <AlertTitle as="h4">
              {messages.regradeCompensatingNoticeTitle}
            </AlertTitle>
            <AlertDescription>
              {messages.regradeCompensatingNoticeBody}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {statusNotice ? (
        <Alert role="status">
          <AlertDescription>{statusNotice}</AlertDescription>
        </Alert>
      ) : null}

      {isManualGradingBlocked ? (
        <Alert>
          <AlertDescription>{messages.nonGradableNotice}</AlertDescription>
        </Alert>
      ) : (
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          noValidate
          className="space-y-4"
        >
          {versionConflict ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle as="h4">{messages.conflictAlertTitle}</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{gradingMessages.errors.conflictVersion}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  disabled={isReloadingLatest || isSubmitting}
                  onClick={() => {
                    void handleReloadLatestVersion();
                  }}
                >
                  {isReloadingLatest
                    ? messages.reloadingLatest
                    : messages.reloadLatestAction}
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <FormRootError form={form} headingLevel="h4" />
          )}

          <FormField
            control={form.control}
            name="score"
            label={messages.scoreLabel}
            description={messages.scoreHelper(maxScore)}
          >
            {(field) => (
              <Input
                {...field}
                type="number"
                inputMode="numeric"
                min={GRADE_LIMITS.minScore}
                max={
                  confirmedGrade && confirmedGrade.score > effectiveMaxScore
                    ? GRADE_LIMITS.maxScore
                    : effectiveMaxScore
                }
                step={1}
                disabled={isSubmitting || isReloadingLatest}
                className="min-h-11 max-w-44"
              />
            )}
          </FormField>

          <FormField
            control={form.control}
            name="feedback"
            label={messages.feedbackLabel}
            description={messages.feedbackHelper(
              feedbackValue.trim().length,
              GRADE_LIMITS.feedbackMaxLength,
            )}
          >
            {(field) => (
              <textarea
                {...field}
                rows={4}
                maxLength={GRADE_LIMITS.feedbackMaxLength}
                placeholder={messages.feedbackPlaceholder}
                disabled={isSubmitting || isReloadingLatest}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors',
                  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  field['aria-invalid'] && 'border-destructive',
                )}
              />
            )}
          </FormField>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              type="submit"
              className="min-h-11"
              disabled={isSubmitting || isReloadingLatest}
            >
              {isSubmitting
                ? isRegrade
                  ? messages.submittingRegrade
                  : messages.submittingGrade
                : isRegrade
                  ? messages.submitRegrade
                  : messages.submitGrade}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
