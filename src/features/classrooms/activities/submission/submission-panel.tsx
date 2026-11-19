import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import { classroomActivitySubmissionQueryKey } from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  LiveRegion,
} from '@/components/feedback/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import type { ActivityDetailDto } from '../activity-schema';
import { formatActivityDeadline } from '../format-activity-deadline';
import { activityMessages } from '../messages';
import { submissionMessages } from './submission-messages';
import type {
  SubmissionDownloadResponseDto,
  SubmissionResponseDto,
} from './submission-schema';
import {
  ALLOWED_EXTENSIONS,
  isUncertainSubmissionError,
  MAX_SUBMISSION_FILES,
  MAX_SUBMISSION_FILE_BYTES,
  readOwnSubmission,
  submitActivityFiles,
} from './submission-service';

export interface SubmissionPanelProps {
  /** The activity the student is viewing, as confirmed by the detail query. */
  readonly activity: ActivityDetailDto;
}

const copy = submissionMessages.panel;

type PanelPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'uploading' }
  | { readonly kind: 'reconciling' }
  /** Verified with the server that nothing was stored; retry keeps the key. */
  | { readonly kind: 'retryable' }
  /** The reconciliation itself failed; verify again before resubmitting. */
  | { readonly kind: 'unverifiable' };

function isAbortError(cause: unknown): boolean {
  return (
    (cause instanceof Error || cause instanceof DOMException) &&
    cause.name === 'AbortError'
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Same contract pre-checks the service enforces, shown inline before sending. */
function preCheckFiles(files: readonly File[]): string | null {
  if (files.length < 1 || files.length > MAX_SUBMISSION_FILES) {
    return submissionMessages.validation.count;
  }
  for (const file of files) {
    const dotIndex = file.name.lastIndexOf('.');
    const extension =
      dotIndex > 0 ? file.name.slice(dotIndex + 1).toLowerCase() : '';
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return submissionMessages.validation.type;
    }
    if (file.size < 1) {
      return submissionMessages.validation.empty;
    }
    if (file.size > MAX_SUBMISSION_FILE_BYTES) {
      return submissionMessages.validation.size;
    }
  }
  return null;
}

/**
 * Display-only window pre-check (`rules/activities-and-grading.md`: the server
 * remains the authority). A closed or not-yet-open window disables the send
 * and explains why, without pretending to decide the outcome.
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

function SubmissionFileList({
  submission,
}: {
  readonly submission: SubmissionDownloadResponseDto | SubmissionResponseDto;
}) {
  const ordered = [...submission.files].sort(
    (left, right) => left.position - right.position,
  );
  return (
    <ul
      aria-label={copy.filesLabel}
      className="min-w-0 space-y-2 rounded-xl border border-border bg-card p-3"
    >
      {ordered.map((file) => (
        <li
          key={file.id}
          className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-b-0 last:pb-0"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium text-foreground wrap-anywhere">
              {file.originalName}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.sizeBytes)}
            </p>
          </div>
          {/* The server-issued signed URL opens in a new tab; never logged. */}
          {'downloadUrl' in file && file.downloadUrl ? (
            <a
              href={file.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
            >
              {copy.downloadLabel}
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Student file-submission panel (#42, HU-ACT-003 part 1/2): shows the
 * server-confirmed own submission, or the upload form with progress, cancel,
 * and idempotent retries. Every shown state comes from the server; the client
 * never derives a submission state or assumes a timeout proved failure
 * (`rules/activities-and-grading.md`).
 */
export function SubmissionPanel({ activity }: SubmissionPanelProps) {
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;

  // One idempotency key per selected-files attempt, rotated when selection changes
  // and reused across retries so the server reconciles instead of duplicating.
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [selectedFiles, setSelectedFiles] = useState<readonly File[]>([]);
  const [phase, setPhase] = useState<PanelPhase>({ kind: 'idle' });
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  /** Server-confirmed submission from the POST response, before read-own lands. */
  const [confirmed, setConfirmed] = useState<SubmissionResponseDto | null>(
    null,
  );

  const abortRef = useRef<AbortController | null>(null);
  const uploadInFlightRef = useRef(false);
  const headingId = useId();
  const inputId = useId();
  const hintId = useId();
  const formErrorId = useId();

  const { client, controller: sessionPort } = useSessionService();
  const isFileActivity = activity.format === 'FILE';

  // Not cacheable per the contract: always fresh, dropped from cache when the
  // panel unmounts so a signed URL never lingers.
  const ownSubmission = useQuery({
    queryKey: classroomActivitySubmissionQueryKey(
      userId ?? 'signed-out',
      activity.classroomId,
      activity.id,
    ),
    queryFn: ({ signal }) => readOwnSubmission(client, activity.id, { signal }),
    enabled: userId !== null && isFileActivity,
    staleTime: 0,
    gcTime: 0,
  });

  // An in-flight upload is aborted when the panel unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (
      phase.kind === 'uploading' ||
      phase.kind === 'reconciling' ||
      phase.kind === 'unverifiable'
    ) {
      return;
    }
    const picked = event.target.files ? Array.from(event.target.files) : [];
    if (picked.length === 0) return;
    setSelectedFiles(picked);
    setIdempotencyKey(crypto.randomUUID());
    setFormError(null);
    setNotice(null);
    setPhase({ kind: 'idle' });
    event.target.value = '';
  }

  function removeFile(file: File) {
    if (
      phase.kind === 'uploading' ||
      phase.kind === 'reconciling' ||
      phase.kind === 'unverifiable'
    ) {
      return;
    }
    setSelectedFiles((current) => current.filter((item) => item !== file));
    setIdempotencyKey(crypto.randomUUID());
    setFormError(null);
  }

  /** Reconciles an uncertain outcome with the server before any resubmission. */
  async function reconcileUncertainOutcome(): Promise<void> {
    setPhase({ kind: 'reconciling' });
    setProgress(null);
    const result = await ownSubmission.refetch();
    if (result.data !== undefined) {
      // The server says the submission exists: show it as confirmed.
      setConfirmed(null);
      setNotice(copy.uncertainReconciledNotice);
      setPhase({ kind: 'idle' });
      return;
    }
    const status =
      result.error instanceof ApiError ? result.error.status : null;
    if (status === 404) {
      // Verified: nothing was stored. A retry with the same key is safe.
      setPhase({ kind: 'retryable' });
      return;
    }
    // The verification itself failed; never offer a blind resubmission.
    setPhase({ kind: 'unverifiable' });
  }

  async function startUpload(files: readonly File[]): Promise<void> {
    // Synchronous duplicate-activation guard for the whole pending attempt.
    if (uploadInFlightRef.current) return;
    const preCheckError = preCheckFiles(files);
    if (preCheckError !== null) {
      setFormError(preCheckError);
      return;
    }
    uploadInFlightRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setFormError(null);
    setNotice(null);
    setPhase({ kind: 'uploading' });
    setProgress(0);

    try {
      const submission = await submitActivityFiles(
        sessionPort,
        activity.id,
        files,
        {
          idempotencyKey,
          signal: controller.signal,
          onProgress: (loaded, total) => {
            setProgress(
              total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0,
            );
          },
        },
      );
      // 200/201: the server confirmed the stored submission.
      setConfirmed(submission);
      setSelectedFiles([]);
      setPhase({ kind: 'idle' });
      setProgress(null);
      // Refresh the own-submission query from server data (signed URLs).
      void ownSubmission.refetch();
      return;
    } catch (cause) {
      if (isAbortError(cause)) {
        // Expected cancellation, never an operation failure.
        setPhase({ kind: 'idle' });
        setProgress(null);
        setNotice(copy.cancelNotice);
        return;
      }
      if (isUncertainSubmissionError(cause)) {
        await reconcileUncertainOutcome();
        return;
      }
      // Definite server rejection: explain it and keep the selection.
      const message =
        cause instanceof ApiError
          ? cause.userMessage
          : submissionMessages.serverErrors.unexpected;
      setPhase({ kind: 'idle' });
      setProgress(null);
      setFormError(message);
      return;
    } finally {
      abortRef.current = null;
      uploadInFlightRef.current = false;
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  // Multiple-choice answering is part 2/2 of HU-ACT-003, still pending.
  if (!isFileActivity) {
    return (
      <EmptyState
        headingLevel="h3"
        title={activityMessages.detail.pendingTabTitle}
        description={activityMessages.detail.submissionPendingDescription}
      />
    );
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

  if (ownSubmission.isPending) {
    return <LoadingState label={copy.loadingLabel} />;
  }

  const readOwnError =
    ownSubmission.error instanceof ApiError ? ownSubmission.error : null;

  const isReconcilePhase =
    phase.kind === 'reconciling' || phase.kind === 'unverifiable';

  if (
    readOwnError !== null &&
    readOwnError.status !== 404 &&
    (!isReconcilePhase || readOwnError.status === 403)
  ) {
    return (
      <ErrorState
        headingLevel="h3"
        title={copy.errorTitle}
        error={readOwnError}
        onRetry={() => {
          void ownSubmission.refetch();
        }}
        isRetrying={ownSubmission.isFetching}
      />
    );
  }

  const submission =
    ownSubmission.data !== undefined ? ownSubmission.data : confirmed;

  if (submission !== null && submission !== undefined) {
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
          <Badge variant={submission.status === 'graded' ? 'info' : 'success'}>
            {copy.statusLabels[submission.status]}
          </Badge>
          {submission.isLate ? (
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
              <time dateTime={submission.submittedAt}>
                {formatActivityDeadline(
                  submission.submittedAt,
                  activity.timeZone,
                )}
              </time>
            </dd>
          </div>
        </dl>

        <SubmissionFileList submission={submission} />
      </section>
    );
  }

  // No own submission (read-own answered 404): render the upload form.
  const windowInfo = describeWindow(activity);
  const isUploading = phase.kind === 'uploading';
  const isReconciling = phase.kind === 'reconciling';
  const isUnverifiable = phase.kind === 'unverifiable';
  const submitDisabled =
    isUploading ||
    isReconciling ||
    isUnverifiable ||
    windowInfo.blocked ||
    selectedFiles.length === 0;
  const percent = progress ?? 0;

  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 space-y-3 rounded-2xl border border-border bg-secondary/30 p-4"
    >
      <div className="space-y-1">
        <h3
          id={headingId}
          className="font-display text-base font-semibold text-foreground"
        >
          {copy.heading}
        </h3>
        <p className="text-sm text-muted-foreground">
          {copy.notSubmittedDescription}
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
              onClick={() => void startUpload(selectedFiles)}
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
              ? activityMessages.lateAllowedLabel
              : activityMessages.lateDisallowedLabel}
          </dd>
        </div>
      </dl>

      {windowInfo.reason !== null ? (
        <Alert role="status">
          <AlertDescription>{windowInfo.reason}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-foreground"
        >
          {copy.form.fileInputLabel}
        </label>
        <p id={hintId} className="text-xs text-muted-foreground">
          {copy.form.fileInputHint}
        </p>
        <input
          id={inputId}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.docx"
          aria-describedby={
            formError !== null ? `${hintId} ${formErrorId}` : hintId
          }
          aria-invalid={formError !== null || undefined}
          disabled={isUploading || isReconciling || isUnverifiable}
          onChange={handleFileChange}
          className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:font-medium file:text-secondary-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
        />
      </div>

      {selectedFiles.length > 0 ? (
        <ul
          aria-label={copy.form.selectedFilesLabel}
          className="min-w-0 space-y-2 rounded-xl border border-border bg-card p-3 text-sm"
        >
          {selectedFiles.map((file) => (
            <li
              key={`${file.name}:${file.size}:${file.lastModified}`}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium text-foreground wrap-anywhere">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              {!isUploading && !isReconciling && !isUnverifiable ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeFile(file)}
                  className="shrink-0"
                >
                  {copy.form.removeFileLabel(file.name)}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {isUploading ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">
              {copy.uploadingLabel}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="shrink-0"
            >
              {copy.cancelAction}
            </Button>
          </div>
          <div
            role="progressbar"
            aria-label={copy.progress.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={copy.progress.valueText(percent)}
            className="h-2 w-full overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
          <LiveRegion
            visuallyHidden
            message={copy.progress.valueText(percent)}
          />
        </div>
      ) : null}

      {!isReconciling ? (
        <Button
          type="button"
          busy={isUploading}
          disabled={submitDisabled}
          onClick={() => void startUpload(selectedFiles)}
        >
          {copy.form.submitLabel}
        </Button>
      ) : null}
    </section>
  );
}
