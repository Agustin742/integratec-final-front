import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import { submissionDetailQueryKey } from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LiveRegion,
  LoadingState,
} from '@/components/feedback/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSessionService } from '@/session/provider';
import { formatActivityDeadline } from '../activities/format-activity-deadline';
import { gradingMessages } from './grading-messages';
import { formatFileSize, type GradingQueueItemDto } from './grading-schema';
import { getSubmissionDetail } from './grading-service';

const messages = gradingMessages.viewer;

export interface SubmissionViewerProps {
  readonly classroomId: string;
  readonly userId: string;
  readonly submission: GradingQueueItemDto;
  readonly activityFormat?: 'FILE' | 'MULTIPLE_CHOICE';
  readonly schoolTimeZone: string;
  readonly onNotFound?: () => void;
}

export function SubmissionViewer({
  classroomId,
  userId,
  submission,
  activityFormat,
  schoolTimeZone,
  onNotFound,
}: SubmissionViewerProps) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const [announcement, setAnnouncement] = useState('');
  const notifiedErrorRef = useRef<unknown>(null);

  const detailQuery = useQuery({
    queryKey: submissionDetailQueryKey(userId, classroomId, submission.id),
    queryFn: ({ signal }) =>
      getSubmissionDetail(client, submission.id, { signal }),
    // Signed download URLs are short-lived and marked `Cache-Control: no-store`.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  // Immediately evict short-lived signed download URLs when closing/switching.
  useEffect(() => {
    const queryKey = submissionDetailQueryKey(
      userId,
      classroomId,
      submission.id,
    );
    return () => {
      queryClient.removeQueries({ queryKey, exact: true });
    };
  }, [classroomId, queryClient, submission.id, userId]);

  const errorStatus =
    detailQuery.error instanceof ApiError ? detailQuery.error.status : null;
  const isNotFound = errorStatus === 404 || errorStatus === 403;

  useEffect(() => {
    if (!isNotFound || detailQuery.error == null) {
      return;
    }
    if (notifiedErrorRef.current === detailQuery.error) {
      return;
    }
    notifiedErrorRef.current = detailQuery.error;
    onNotFound?.();
  }, [detailQuery.error, isNotFound, onNotFound]);

  const handleRefreshLinks = async (): Promise<void> => {
    const result = await detailQuery.refetch();
    if (!result.isError && result.data !== undefined) {
      setAnnouncement(messages.linksRefreshed);
    }
  };

  const sortedFiles = detailQuery.data
    ? [...detailQuery.data.files].sort((a, b) => a.position - b.position)
    : [];

  return (
    <section
      aria-label={messages.sectionTitle}
      className="space-y-4 rounded-xl border border-border bg-surface-subtle/50 p-4"
    >
      <LiveRegion message={announcement} visuallyHidden />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {messages.sectionTitle}
        </h3>
        {detailQuery.data && sortedFiles.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={detailQuery.isFetching}
            onClick={() => {
              void handleRefreshLinks();
            }}
          >
            {detailQuery.isFetching
              ? messages.refreshingLinks
              : messages.refreshLinks}
          </Button>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            {messages.studentLabel}
          </dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {submission.studentDisplayName}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            {messages.activityLabel}
          </dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {submission.activityTitle}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            {messages.submittedAtLabel}
          </dt>
          <dd className="mt-0.5 text-foreground">
            {formatActivityDeadline(submission.submittedAt, schoolTimeZone)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            {messages.statusLabel}
          </dt>
          <dd className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge
              variant={submission.status === 'graded' ? 'success' : 'secondary'}
            >
              {submission.status === 'graded'
                ? gradingMessages.badges.graded
                : gradingMessages.badges.submitted}
            </Badge>
            <Badge variant="outline">
              {submission.activityType === 'EXAM'
                ? gradingMessages.badges.exam
                : gradingMessages.badges.tp}
            </Badge>
            {submission.isLate ? (
              <Badge variant="warning">{gradingMessages.badges.late}</Badge>
            ) : null}
          </dd>
        </div>
      </dl>

      {activityFormat === 'MULTIPLE_CHOICE' ? (
        <Alert>
          <AlertTitle as="h4">{messages.mcqPendingTitle}</AlertTitle>
          <AlertDescription>{messages.mcqPendingDescription}</AlertDescription>
        </Alert>
      ) : null}

      {detailQuery.isPending ? (
        <LoadingState label={messages.loading} />
      ) : isNotFound ? (
        <ErrorState
          headingLevel="h4"
          title={messages.notFoundTitle}
          description={messages.notFoundDescription}
        />
      ) : detailQuery.isError ? (
        <ErrorState
          headingLevel="h4"
          title={messages.loadErrorTitle}
          description={messages.loadErrorDescription}
          onRetry={() => {
            void detailQuery.refetch();
          }}
        />
      ) : sortedFiles.length === 0 ? (
        <EmptyState
          headingLevel="h4"
          title={messages.emptyFilesTitle}
          description={messages.emptyFilesDescription}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {messages.signedLinkHint}
          </p>
          <ul className="space-y-2">
            {sortedFiles.map((file) => (
              <li
                key={file.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="break-words text-sm font-medium text-foreground">
                    {file.originalName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.sizeBytes)} · {file.contentType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {messages.linkExpiresPrefix}{' '}
                    {formatActivityDeadline(
                      file.downloadUrlExpiresAt,
                      schoolTimeZone,
                    )}
                  </p>
                </div>
                <a
                  href={file.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonStyles({ variant: 'outline', size: 'sm' }),
                    'min-h-11 shrink-0',
                  )}
                >
                  {messages.openFileAction}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
