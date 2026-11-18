import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import type { TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { validateMaterialFile } from './material-schema';
import {
  isUncertainMaterialError,
  uploadClassroomMaterial,
} from './material-service';
import { materialMessages } from './messages';

export interface MaterialUploadSectionProps {
  readonly client: TypedApiClient;
  readonly classroomId: string;
  readonly onUploaded: (filename: string) => Promise<void> | void;
  readonly onReconcileRequired: () => Promise<void> | void;
}

type UploadPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'uploading'; readonly filename: string }
  | { readonly kind: 'cancelled' }
  | {
      readonly kind: 'error';
      readonly message: string;
      readonly uncertain: boolean;
    };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isAbortError(cause: unknown): boolean {
  return (
    (cause instanceof Error || cause instanceof DOMException) &&
    cause.name === 'AbortError'
  );
}

export function MaterialUploadSection({
  client,
  classroomId,
  onUploaded,
  onReconcileRequired,
}: MaterialUploadSectionProps) {
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>({ kind: 'idle' });
  const [isDragging, setIsDragging] = useState(false);

  function selectCandidateFile(file: File | undefined) {
    if (!file || phase.kind === 'uploading') return;
    setPhase({ kind: 'idle' });
    const check = validateMaterialFile(file);
    if (!check.ok) {
      setSelectedFile(null);
      setClientError(materialMessages.upload.clientErrors[check.reason]);
      return;
    }
    setClientError(null);
    setSelectedFile(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    selectCandidateFile(file);
    event.target.value = '';
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (phase.kind !== 'uploading') setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectCandidateFile(event.dataTransfer.files?.[0]);
  }

  async function startUpload() {
    if (!selectedFile || phase.kind === 'uploading') return;

    const controller = new AbortController();
    abortRef.current = controller;
    setClientError(null);
    setPhase({ kind: 'uploading', filename: selectedFile.name });

    try {
      const created = await uploadClassroomMaterial(
        client,
        classroomId,
        selectedFile,
        { signal: controller.signal },
      );
      abortRef.current = null;
      setSelectedFile(null);
      setPhase({ kind: 'idle' });
      await onUploaded(created.filename);
    } catch (error) {
      abortRef.current = null;
      if (isAbortError(error)) {
        setPhase({ kind: 'cancelled' });
        return;
      }
      const uncertain = isUncertainMaterialError(error);
      const message =
        error instanceof ApiError
          ? error.userMessage
          : materialMessages.upload.serverErrors.unexpected;
      setPhase({ kind: 'error', message, uncertain });
      if (uncertain) {
        await onReconcileRequired();
      }
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  const isUploading = phase.kind === 'uploading';

  return (
    <section
      aria-label={materialMessages.upload.sectionTitle}
      className="min-w-0 space-y-3 rounded-2xl border border-border bg-secondary/30 p-4"
    >
      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold text-foreground">
          {materialMessages.upload.sectionTitle}
        </h3>
        <p id={hintId} className="text-sm text-muted-foreground">
          {materialMessages.upload.sectionDescription}
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col gap-3 rounded-xl border border-dashed p-4 transition-colors sm:flex-row sm:items-center sm:justify-between',
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border bg-background/80',
        )}
      >
        <div className="min-w-0 space-y-1">
          <label
            htmlFor={inputId}
            className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              className="size-4 shrink-0 text-primary"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
              />
            </svg>
            <span>{materialMessages.upload.dropzoneLabel}</span>
          </label>
          <p className="text-xs text-muted-foreground">
            {materialMessages.upload.dropzoneHint}
          </p>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".pdf,application/pdf,image/png,image/jpeg"
          aria-describedby={hintId}
          disabled={isUploading}
          onChange={handleFileChange}
          className="sr-only"
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="shrink-0"
        >
          {selectedFile
            ? materialMessages.upload.replaceFileAction
            : materialMessages.upload.chooseFileAction}
        </Button>
      </div>

      {clientError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{clientError}</AlertDescription>
        </Alert>
      )}

      {selectedFile && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm">
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium text-foreground wrap-anywhere">
              {materialMessages.upload.selectedFileLabel}: {selectedFile.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
          {!isUploading && (
            <Button
              type="button"
              size="sm"
              onClick={() => void startUpload()}
              className="shrink-0"
            >
              {phase.kind === 'cancelled' || phase.kind === 'error'
                ? materialMessages.upload.retryAction
                : materialMessages.upload.submitAction}
            </Button>
          )}
        </div>
      )}

      {isUploading && (
        <div
          role="status"
          aria-live="polite"
          className="space-y-2 rounded-xl border border-border bg-card p-3"
        >
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-foreground wrap-anywhere">
              {materialMessages.upload.uploadingStatus(phase.filename)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="shrink-0"
            >
              {materialMessages.upload.cancelAction}
            </Button>
          </div>
          <div
            role="progressbar"
            aria-label={materialMessages.upload.progressLabel}
            aria-valuetext={materialMessages.upload.uploadingStatus(
              phase.filename,
            )}
            className="h-2 w-full overflow-hidden rounded-full bg-secondary"
          >
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      )}

      {phase.kind === 'cancelled' && (
        <Alert role="status">
          <AlertDescription>
            {materialMessages.upload.cancelledNotice}
          </AlertDescription>
        </Alert>
      )}

      {phase.kind === 'error' && (
        <Alert variant="destructive" role="alert">
          {phase.uncertain && (
            <AlertTitle>{materialMessages.upload.uncertainTitle}</AlertTitle>
          )}
          <AlertDescription className="space-y-2">
            <p>{phase.message}</p>
            {phase.uncertain && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onReconcileRequired()}
              >
                {materialMessages.upload.refreshListAction}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
