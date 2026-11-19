import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import { classroomExamAttemptQueryKey } from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/feedback/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import type { ActivityDetailDto } from '../activity-schema';
import { formatActivityDeadline } from '../format-activity-deadline';
import { activityMessages } from '../messages';
import { examMessages } from './exam-messages';
import {
  isUncertainExamAnswerError,
  readOwnExamAttempt,
  submitExamAnswers,
} from './exam-service';
import type { ExamAnswerSubmissionResponseDto } from './exam-schema';

export interface ExamAnsweringPanelProps {
  /** The exam activity the student is viewing, as confirmed by the detail query. */
  readonly activity: ActivityDetailDto;
}

const copy = examMessages.panel;

type PanelPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'reconciling' }
  /** Verified with the server that nothing was stored; retry keeps the key. */
  | { readonly kind: 'retryable' }
  /** The reconciliation itself failed; verify again before resubmitting. */
  | { readonly kind: 'unverifiable' };

/** Rendering shape of one question; correct-answer flags never reach here. */
interface RenderQuestion {
  readonly id: string;
  readonly position: number;
  readonly prompt: string;
  readonly options: readonly {
    readonly id: string;
    readonly position: number;
    readonly label: string;
  }[];
}

function isAbortError(cause: unknown): boolean {
  return (
    (cause instanceof Error || cause instanceof DOMException) &&
    cause.name === 'AbortError'
  );
}

/**
 * Display-only window pre-check (`rules/activities-and-grading.md`: the server
 * remains the authority, including whether an exam is in progress). A closed
 * or not-yet-open window disables the send and explains why, without
 * pretending to decide the outcome.
 */
function describeWindow(activity: ActivityDetailDto): {
  readonly blocked: boolean;
  readonly reason: string | null;
} {
  const nowMs = Date.now();
  if (activity.opensAt !== null) {
    const opensAtMs = Date.parse(activity.opensAt);
    if (!Number.isNaN(opensAtMs) && nowMs < opensAtMs) {
      return { blocked: true, reason: copy.window.notOpenReason };
    }
  }
  const dueAtMs = Date.parse(activity.dueAt);
  if (!Number.isNaN(dueAtMs) && nowMs > dueAtMs && !activity.allowLate) {
    return { blocked: true, reason: copy.window.closedReason };
  }
  return { blocked: false, reason: null };
}

/**
 * Student multiple-choice exam answering (#43, HU-ACT-003 part 2/2): renders
 * one radio group per published question with a submit confirmation, keeps
 * the selected answers across recoverable failures, reconciles
 * outcome-uncertain submissions with the server before any resubmission, and
 * shows the server-computed result only. The browser never computes a score
 * and no correct answer is ever displayed (`rules/activities-and-grading.md`,
 * `RN-06`).
 */
export function ExamAnsweringPanel({ activity }: ExamAnsweringPanelProps) {
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;

  // One idempotency key per answered-attempt, rotated when the selection
  // changes and reused across retries so the server reconciles instead of
  // duplicating the attempt.
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [selectedAnswers, setSelectedAnswers] = useState<
    Readonly<Record<string, string>>
  >({});
  const [phase, setPhase] = useState<PanelPhase>({ kind: 'idle' });
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Server-confirmed result from the POST response, before read-own lands. */
  const [confirmed, setConfirmed] =
    useState<ExamAnswerSubmissionResponseDto | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const submitInFlightRef = useRef(false);
  const headingId = useId();
  const formErrorId = useId();

  const { client } = useSessionService();

  // Not cacheable per the contract: always fresh, dropped from cache when the
  // panel unmounts so nothing lingers.
  const ownAttempt = useQuery({
    queryKey: classroomExamAttemptQueryKey(
      userId ?? 'signed-out',
      activity.classroomId,
      activity.id,
    ),
    queryFn: ({ signal }) =>
      readOwnExamAttempt(client, activity.id, { signal }),
    enabled: userId !== null,
    staleTime: 0,
    gcTime: 0,
  });

  // An in-flight submission is aborted when the panel unmounts; the
  // idempotency key reconciles the outcome on the next visit.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const questions: readonly RenderQuestion[] = [...activity.questions]
    .sort((left, right) => left.position - right.position)
    .map((question) => ({
      id: question.id,
      position: question.position,
      prompt: question.prompt,
      options: [...question.options].sort(
        (left, right) => left.position - right.position,
      ),
    }));

  function handleSelect(questionId: string, optionId: string) {
    if (
      phase.kind === 'submitting' ||
      phase.kind === 'reconciling' ||
      phase.kind === 'unverifiable'
    ) {
      return;
    }
    setSelectedAnswers((current) => ({ ...current, [questionId]: optionId }));
    setIdempotencyKey(crypto.randomUUID());
    setFormError(null);
    setNotice(null);
    setPhase({ kind: 'idle' });
  }

  /** Reconciles an uncertain outcome with the server before any resubmission. */
  async function reconcileUncertainOutcome(): Promise<void> {
    setPhase({ kind: 'reconciling' });
    const result = await ownAttempt.refetch();
    if (result.data) {
      // The server says the attempt exists: show it as confirmed.
      setConfirmed(null);
      setNotice(copy.reconciledNotice);
      setPhase({ kind: 'idle' });
      return;
    }
    if (result.data === null) {
      // Verified: nothing was stored. A retry with the same key is safe.
      setPhase({ kind: 'retryable' });
      return;
    }
    // The verification itself failed; never offer a blind resubmission.
    setPhase({ kind: 'unverifiable' });
  }

  function unansweredCount(): number {
    return questions.filter(
      (question) => selectedAnswers[question.id] === undefined,
    ).length;
  }

  function handleOpenConfirm() {
    if (unansweredCount() > 0) {
      setFormError(examMessages.validation.answers);
      return;
    }
    setFormError(null);
    setConfirmOpen(true);
  }

  async function startSubmit(): Promise<void> {
    // Synchronous duplicate-activation guard for the whole pending attempt.
    if (submitInFlightRef.current) return;
    if (unansweredCount() > 0) {
      setFormError(examMessages.validation.answers);
      setConfirmOpen(false);
      return;
    }
    submitInFlightRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setFormError(null);
    setNotice(null);
    setPhase({ kind: 'submitting' });
    setConfirmOpen(false);

    const answers = questions.flatMap((question) => {
      const optionId = selectedAnswers[question.id];
      return optionId !== undefined
        ? [{ questionId: question.id, selectedOptionIds: [optionId] }]
        : [];
    });

    try {
      const result = await submitExamAnswers(client, activity.id, answers, {
        idempotencyKey,
        signal: controller.signal,
      });
      // 200/201: the server confirmed the stored, auto-graded attempt.
      setConfirmed(result);
      setPhase({ kind: 'idle' });
      // Refresh the own-attempt query from server data.
      void ownAttempt.refetch();
      return;
    } catch (cause) {
      if (isAbortError(cause)) {
        // Expected cancellation, never an operation failure.
        setPhase({ kind: 'idle' });
        return;
      }
      if (isUncertainExamAnswerError(cause)) {
        await reconcileUncertainOutcome();
        return;
      }
      // Definite server rejection: explain it and keep the selections.
      const message =
        cause instanceof ApiError
          ? cause.userMessage
          : examMessages.serverErrors.unexpected;
      setPhase({ kind: 'idle' });
      setFormError(message);
      return;
    } finally {
      abortRef.current = null;
      submitInFlightRef.current = false;
    }
  }

  if (userId === null) {
    return (
      <ErrorState
        headingLevel="h3"
        title={copy.errorTitle}
        description={activityMessages.errorDescription}
      />
    );
  }

  if (ownAttempt.isPending) {
    return <LoadingState label={copy.loadingLabel} />;
  }

  const readOwnError =
    ownAttempt.error instanceof ApiError ? ownAttempt.error : null;
  const isReconcilePhase =
    phase.kind === 'reconciling' || phase.kind === 'unverifiable';

  if (
    readOwnError !== null &&
    (!isReconcilePhase || readOwnError.status === 403)
  ) {
    return (
      <ErrorState
        headingLevel="h3"
        title={copy.errorTitle}
        error={readOwnError}
        onRetry={() => {
          void ownAttempt.refetch();
        }}
        isRetrying={ownAttempt.isFetching}
      />
    );
  }

  const attempt =
    ownAttempt.data !== undefined && ownAttempt.data !== null
      ? ownAttempt.data
      : confirmed;

  if (attempt !== null) {
    return (
      <section
        aria-labelledby={headingId}
        className="min-w-0 space-y-4 rounded-2xl border border-edge bg-secondary/30 p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3
            id={headingId}
            className="font-display text-base font-semibold text-foreground"
          >
            {copy.heading}
          </h3>
          <Badge variant="info">{copy.statusLabels.graded}</Badge>
          {attempt.isLate ? (
            <Badge variant="warning">{copy.lateBadge}</Badge>
          ) : null}
        </div>

        {notice !== null ? (
          <Alert role="status">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-foreground">
              {copy.submittedAtTerm}
            </dt>
            <dd className="text-muted-foreground">
              <time dateTime={attempt.submittedAt}>
                {formatActivityDeadline(attempt.submittedAt, activity.timeZone)}
              </time>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">{copy.scoreTerm}</dt>
            {/* Server-computed result; the browser never calculates a score. */}
            <dd className="text-muted-foreground">
              {copy.scoreValue(attempt.score, attempt.maxScore)}
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  if (questions.length === 0) {
    return (
      <EmptyState
        headingLevel="h3"
        title={copy.noQuestionsTitle}
        description={copy.noQuestionsDescription}
      />
    );
  }

  // No own attempt (read-own answered 404): render the answering form.
  const windowInfo = describeWindow(activity);
  const isSubmitting = phase.kind === 'submitting';
  const isReconciling = phase.kind === 'reconciling';
  const isUnverifiable = phase.kind === 'unverifiable';
  const inputsDisabled = isSubmitting || isReconciling || isUnverifiable;
  const submitDisabled = inputsDisabled || windowInfo.blocked;

  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 space-y-4 rounded-2xl border border-border bg-secondary/30 p-4"
    >
      <div className="space-y-1">
        <h3
          id={headingId}
          className="font-display text-base font-semibold text-foreground"
        >
          {copy.heading}
        </h3>
        <p className="text-sm text-muted-foreground">
          {copy.notAttemptedDescription}
        </p>
      </div>

      {formError !== null ? (
        <Alert id={formErrorId} variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {notice !== null ? (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      {phase.kind === 'reconciling' ? (
        <Alert role="status">
          <AlertDescription>{copy.uncertainChecking}</AlertDescription>
        </Alert>
      ) : null}

      {phase.kind === 'retryable' ? (
        <Alert role="status">
          <AlertTitle>{copy.uncertainTitle}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{copy.uncertainNothingStored}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void startSubmit()}
            >
              {copy.retryAction}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {phase.kind === 'unverifiable' ? (
        <Alert role="status">
          <AlertTitle>{copy.uncertainTitle}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{copy.uncertainUnverified}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void reconcileUncertainOutcome()}
            >
              {copy.verifyAgainAction}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-foreground">
            {copy.window.dueAtLabel}
          </dt>
          <dd className="text-muted-foreground">
            <time dateTime={activity.dueAt}>
              {formatActivityDeadline(activity.dueAt, activity.timeZone)}
            </time>
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">
            {copy.window.latePolicyTerm}
          </dt>
          <dd className="text-muted-foreground">
            {activity.allowLate
              ? copy.window.lateAllowedTerm
              : copy.window.lateNotAllowedTerm}
          </dd>
        </div>
      </dl>

      {windowInfo.reason !== null ? (
        <Alert role="status">
          <AlertDescription>{windowInfo.reason}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={(event) => event.preventDefault()} className="space-y-4">
        {questions.map((question, index) => (
          <fieldset
            key={question.id}
            className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4"
          >
            <legend className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {copy.questionLegend(index + 1, questions.length)}
            </legend>
            <p className="text-sm font-medium text-foreground wrap-anywhere">
              {question.prompt}
            </p>
            <div className="space-y-2">
              {question.options.map((option) => {
                const optionInputId = `${activity.id}:${question.id}:${option.id}`;
                return (
                  <label
                    htmlFor={optionInputId}
                    className="group block cursor-pointer rounded-2xl border-2 border-border bg-background p-3.5 motion-safe:transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-ring"
                  >
                    <input
                      id={optionInputId}
                      type="radio"
                      name={`${activity.id}:${question.id}`}
                      value={option.id}
                      checked={selectedAnswers[question.id] === option.id}
                      onChange={() => handleSelect(question.id, option.id)}
                      disabled={inputsDisabled}
                      className="sr-only"
                    />
                    <span className="flex min-h-6 items-center gap-3 text-sm text-foreground wrap-anywhere">
                      <span
                        aria-hidden="true"
                        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-border bg-background group-has-[:checked]:border-primary"
                      >
                        <span className="size-2.5 rounded-full bg-primary opacity-0 group-has-[:checked]:opacity-100" />
                      </span>
                      {option.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        {!isReconciling ? (
          <Button
            type="button"
            busy={isSubmitting}
            disabled={submitDisabled}
            onClick={handleOpenConfirm}
          >
            {copy.submitLabel}
          </Button>
        ) : null}
      </form>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>{copy.confirm.title}</DialogTitle>
          <DialogDescription>{copy.confirm.description}</DialogDescription>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              {copy.confirm.cancel}
            </Button>
            <Button
              type="button"
              busy={isSubmitting}
              onClick={() => void startSubmit()}
            >
              {copy.confirm.action}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
