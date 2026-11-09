import { useId, type ComponentProps, type ReactNode } from 'react';
import { ApiError } from '@/api/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { feedbackMessages } from './messages';

export type LoadingStateProps = Omit<ComponentProps<'div'>, 'children'> & {
  label?: string;
  skeletonLines?: number;
};

/**
 * Presentational loading state (`rules/error-handling-and-feedback.md`).
 * Marks the container `aria-busy="true"` while keeping the polite `role="status"`
 * live region on a separate child element so screen readers do not suppress the
 * announcement due to `aria-busy="true"` on the live region itself.
 */
export function LoadingState({
  label = feedbackMessages.loading,
  skeletonLines = 3,
  className,
  ...props
}: LoadingStateProps) {
  const labelId = useId();
  const lineCount = Math.max(1, Math.min(skeletonLines, 8));

  return (
    <div
      {...props}
      aria-busy="true"
      aria-labelledby={labelId}
      data-state-kind="loading"
      className={cn(
        'min-w-0 space-y-3 rounded-2xl border border-edge bg-card p-5 text-card-foreground shadow-panel',
        className,
      )}
    >
      <p
        id={labelId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="font-display text-sm font-semibold"
      >
        {label}
      </p>
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: lineCount }, (_, index) => (
          <Skeleton
            key={index}
            className={cn(
              'h-4',
              index === lineCount - 1 && lineCount > 1 ? 'w-2/3' : 'w-full',
            )}
          />
        ))}
      </div>
    </div>
  );
}

export type EmptyStateProps = Omit<ComponentProps<'section'>, 'title'> & {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  headingLevel?: 'h2' | 'h3' | 'h4';
};

/**
 * Presentational empty-results state visually and programmatically distinct from
 * loading and error states (`rules/error-handling-and-feedback.md`).
 */
export function EmptyState({
  title,
  description,
  action,
  headingLevel: Heading = 'h3',
  className,
  ...props
}: EmptyStateProps) {
  const titleId = useId();

  return (
    <section
      {...props}
      aria-labelledby={titleId}
      data-state-kind="empty"
      className={cn(
        'min-w-0 space-y-2 rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-center text-secondary-foreground shadow-panel',
        className,
      )}
    >
      <Heading
        id={titleId}
        className="font-display text-lg font-semibold text-foreground"
      >
        {title}
      </Heading>
      {description != null && description !== false && (
        <p className="mx-auto max-w-prose text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action != null && action !== false && (
        <div className="pt-2">{action}</div>
      )}
    </section>
  );
}

export type ErrorStateProps = Omit<ComponentProps<'div'>, 'title'> & {
  title?: ReactNode;
  description?: ReactNode;
  error?: unknown;
  nextAction?: ReactNode;
  onRetry?: () => void;
  isRetrying?: boolean;
  retryLabel?: string;
  retryingLabel?: string;
  action?: ReactNode;
  headingLevel?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
};

function resolveErrorDescription(
  description: ReactNode | undefined,
  error: unknown,
): ReactNode {
  if (description != null && description !== false && description !== '') {
    return description;
  }
  if (error instanceof ApiError) {
    return error.userMessage;
  }
  return feedbackMessages.errorFallbackDescription;
}

/**
 * Presentational error state with bounded retry and next-action guidance
 * (`rules/error-handling-and-feedback.md`). Never exposes stack traces or internal details.
 */
export function ErrorState({
  title = feedbackMessages.errorTitle,
  description,
  error,
  nextAction,
  onRetry,
  isRetrying = false,
  retryLabel = feedbackMessages.retry,
  retryingLabel = feedbackMessages.retrying,
  action,
  headingLevel = 'h3',
  className,
  ...props
}: ErrorStateProps) {
  const resolvedDescription = resolveErrorDescription(description, error);

  return (
    <Alert
      {...props}
      variant="destructive"
      role="alert"
      data-state-kind="error"
      className={className}
    >
      <AlertTitle as={headingLevel}>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{resolvedDescription}</p>
        {nextAction != null && nextAction !== false && (
          <p className="text-sm font-medium">{nextAction}</p>
        )}
        {(onRetry != null || (action != null && action !== false)) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {onRetry != null && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                busy={isRetrying}
                onClick={onRetry}
              >
                {isRetrying ? retryingLabel : retryLabel}
              </Button>
            )}
            {action}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

export type StaleDataNoticeProps = Omit<ComponentProps<'div'>, 'title'> & {
  title?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  isRetrying?: boolean;
  retryLabel?: string;
  retryingLabel?: string;
  headingLevel?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
};

/**
 * Non-destructive warning banner shown alongside preserved content when a
 * background refresh fails (`rules/error-handling-and-feedback.md`).
 */
export function StaleDataNotice({
  title = feedbackMessages.staleTitle,
  description = feedbackMessages.staleDescription,
  onRetry,
  isRetrying = false,
  retryLabel = feedbackMessages.refresh,
  retryingLabel = feedbackMessages.refreshing,
  headingLevel = 'h3',
  className,
  ...props
}: StaleDataNoticeProps) {
  return (
    <Alert
      {...props}
      variant="warning"
      role="status"
      data-state-kind="stale"
      className={className}
    >
      <AlertTitle as={headingLevel}>{title}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{description}</p>
        {onRetry != null && (
          <div className="pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              busy={isRetrying}
              onClick={onRetry}
            >
              {isRetrying ? retryingLabel : retryLabel}
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

export type LiveRegionProps = Omit<ComponentProps<'div'>, 'children'> & {
  message: ReactNode;
  politeness?: 'polite' | 'assertive';
  visuallyHidden?: boolean;
};

/**
 * Live-region announcement primitive for async results (`rules/ui-and-accessibility.md`).
 */
export function LiveRegion({
  message,
  politeness = 'polite',
  visuallyHidden = false,
  className,
  ...props
}: LiveRegionProps) {
  return (
    <div
      {...props}
      role={politeness === 'assertive' ? 'alert' : 'status'}
      aria-live={politeness}
      aria-atomic="true"
      className={cn(
        visuallyHidden ? 'sr-only' : 'text-sm text-muted-foreground',
        className,
      )}
    >
      {message}
    </div>
  );
}
