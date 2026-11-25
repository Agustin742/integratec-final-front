import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  createFamilyReportCardPredicate,
  familyLinksQueryKey,
  familyReportCardQueryKey,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { DEFAULT_PAGE_SIZE } from '@/components/pagination/pagination';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonStyles } from '@/components/ui/button';
import { formatConnectedSeconds } from '@/features/classrooms/grades/format-connected-seconds';
import { formatInstant } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import type {
  FamilyLinkDto,
  FamilyMetricsSummaryDto,
  ReportCardItemDto,
} from './family-schema';
import {
  getFamilyReportCard,
  isFamilyServiceError,
  listFamilyLinks,
} from './family-service';
import { familyMessages } from './messages';

export interface FamilyAreaViewProps {
  readonly title?: string;
}

const primaryLinkClass =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2 font-display text-sm font-semibold text-primary-foreground [--key:var(--key-primary)] key-bevel motion-press focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring';

function formatGradedInstant(iso: string): string {
  try {
    return formatInstant(iso);
  } catch {
    return iso;
  }
}

function formatAveragePercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return familyMessages.metrics.averageScoreEmpty;
  }
  const formatted = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted}%`;
}

function computeScorePercent(score: number, maxScore: number): number {
  if (maxScore <= 0) {
    return 0;
  }
  return Math.round((score / maxScore) * 100);
}

export function FamilyAreaView({
  title = familyMessages.title,
}: FamilyAreaViewProps) {
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;

  if (userId === null) {
    return null;
  }

  return <FamilyAreaWorkspace key={userId} userId={userId} title={title} />;
}

interface FamilyAreaWorkspaceProps {
  readonly userId: string;
  readonly title: string;
}

function FamilyAreaWorkspace({ userId, title }: FamilyAreaWorkspaceProps) {
  const { client } = useSessionService();
  const navigate = useNavigate();
  const { linkId: rawParamLinkId } = useParams<{ linkId?: string }>();
  const [searchParams] = useSearchParams();

  const paramLinkId = (rawParamLinkId ?? '').trim();
  const classroomIdParam = (searchParams.get('classroomId') ?? '').trim();

  const linksQuery = useQuery({
    queryKey: familyLinksQueryKey(userId),
    queryFn: ({ signal }) => listFamilyLinks(client, { signal }),
  });

  const links = linksQuery.data?.items ?? [];

  const hasExplicitLinkParam = paramLinkId !== '';
  const explicitLink = hasExplicitLinkParam
    ? (links.find((item) => item.id === paramLinkId) ?? null)
    : null;
  const classroomMatchedLink =
    !hasExplicitLinkParam && classroomIdParam !== ''
      ? (links.find((item) => item.classroomId === classroomIdParam) ?? null)
      : null;

  const selectedLink: FamilyLinkDto | null = hasExplicitLinkParam
    ? explicitLink
    : (classroomMatchedLink ?? links[0] ?? null);

  const isMissingRequestedLink =
    linksQuery.data !== undefined &&
    links.length > 0 &&
    hasExplicitLinkParam &&
    explicitLink === null;

  const handleSelectLink = (link: FamilyLinkDto) => {
    if (selectedLink?.id === link.id && !isMissingRequestedLink) {
      return;
    }
    void navigate(`/family/${encodeURIComponent(link.id)}`);
  };

  return (
    <section className="min-w-0 space-y-6">
      <header className="min-w-0 space-y-3">
        <div>
          <Link
            to="/"
            className={buttonStyles({ variant: 'outline', size: 'sm' })}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {familyMessages.backToClassrooms}
          </Link>
        </div>

        <div className="min-w-0 space-y-1.5">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground wrap-anywhere">
            {title}
          </h2>
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">
            {familyMessages.subtitle}
          </p>
        </div>
      </header>

      {linksQuery.isPending && (
        <LoadingState label={familyMessages.loadingLinks} />
      )}

      {linksQuery.isError && linksQuery.data === undefined && (
        <ErrorState
          headingLevel="h3"
          title={familyMessages.errors.linksTitle}
          description={
            isFamilyServiceError(linksQuery.error)
              ? linksQuery.error.userMessage
              : familyMessages.errors.linksDescription
          }
          onRetry={() => void linksQuery.refetch()}
          isRetrying={linksQuery.isRefetching}
          retryLabel={familyMessages.errors.retryAction}
        />
      )}

      {linksQuery.isError && linksQuery.data !== undefined && (
        <StaleDataNotice
          headingLevel="h3"
          title={familyMessages.errors.linksStaleTitle}
          description={familyMessages.errors.linksStaleDescription}
          onRetry={() => void linksQuery.refetch()}
          isRetrying={linksQuery.isRefetching}
          retryLabel={familyMessages.errors.retryAction}
        />
      )}

      {linksQuery.data !== undefined && links.length === 0 && (
        <EmptyState
          headingLevel="h3"
          title={familyMessages.empty.title}
          description={familyMessages.empty.description}
          action={
            <Link to="/invitations/accept" className={primaryLinkClass}>
              {familyMessages.empty.acceptInvitationCta}
            </Link>
          }
        />
      )}

      {linksQuery.data !== undefined && links.length > 0 && (
        <div className="min-w-0 space-y-6">
          {links.length > 1 && (
            <section
              aria-label={familyMessages.selector.regionLabel}
              className="min-w-0 space-y-3 rounded-2xl border border-edge bg-card p-4 shadow-panel"
            >
              <h3 className="font-display text-base font-semibold text-foreground">
                {familyMessages.selector.heading}
              </h3>
              <div className="flex min-w-0 flex-wrap gap-2">
                {links.map((link) => {
                  const isSelected = selectedLink?.id === link.id;
                  return (
                    <button
                      key={link.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleSelectLink(link)}
                      className={cn(
                        'inline-flex min-h-11 max-w-full flex-wrap items-center gap-2 rounded-xl border-2 px-3.5 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-edge bg-tray text-foreground hover:bg-card',
                      )}
                    >
                      <span className="min-w-0 wrap-anywhere">
                        {link.childDisplayName} · {link.classroomName}
                      </span>
                      {link.adultMode && (
                        <Badge
                          variant={isSelected ? 'secondary' : 'warning'}
                          className="shrink-0"
                        >
                          {familyMessages.selector.adultModeBadge}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {isMissingRequestedLink ? (
            <ErrorState
              headingLevel="h3"
              title={familyMessages.errors.notFoundTitle}
              description={familyMessages.errors.notFoundDescription}
              action={
                <Link to="/family" className={primaryLinkClass}>
                  {familyMessages.errors.notFoundBackToFamily}
                </Link>
              }
            />
          ) : selectedLink !== null ? (
            <div className="min-w-0 space-y-6">
              <div
                aria-label={familyMessages.selector.activeContextLabel(
                  selectedLink.childDisplayName,
                  selectedLink.classroomName,
                )}
                className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-2xl border border-edge bg-card p-4 shadow-panel"
              >
                <div className="min-w-0 space-y-1">
                  <h3 className="font-display text-lg font-semibold text-foreground wrap-anywhere">
                    {selectedLink.childDisplayName}
                  </h3>
                  <p className="text-sm text-muted-foreground wrap-anywhere">
                    {selectedLink.classroomName}
                    {selectedLink.classroomSubject
                      ? ` · ${selectedLink.classroomSubject}`
                      : ''}
                  </p>
                </div>
                <Badge variant={selectedLink.adultMode ? 'warning' : 'info'}>
                  {selectedLink.adultMode
                    ? familyMessages.selector.adultModeBadge
                    : familyMessages.selector.schoolModeBadge}
                </Badge>
              </div>

              {selectedLink.adultMode ? (
                <Alert variant="warning" role="status">
                  <AlertTitle as="h4">
                    {familyMessages.adultMode.title}
                  </AlertTitle>
                  <AlertDescription>
                    {familyMessages.adultMode.description}
                  </AlertDescription>
                </Alert>
              ) : (
                <FamilyReportCardSection
                  key={`${userId}:${selectedLink.id}`}
                  userId={userId}
                  link={selectedLink}
                />
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function FamilyMetricsGrid({
  metrics,
}: {
  readonly metrics: FamilyMetricsSummaryDto;
}) {
  const cards = [
    {
      label: familyMessages.metrics.averageScoreLabel,
      value: formatAveragePercent(metrics.averageScorePercent),
    },
    {
      label: familyMessages.metrics.gradedCountLabel,
      value: String(metrics.gradedCount),
    },
    {
      label: familyMessages.metrics.pendingCountLabel,
      value: String(metrics.pendingCount),
    },
    {
      label: familyMessages.metrics.ungradedCountLabel,
      value: String(metrics.ungradedCount),
    },
    {
      label: familyMessages.metrics.connectedTimeLabel,
      value: formatConnectedSeconds(metrics.connectedSeconds),
    },
    {
      label: familyMessages.metrics.submissionCountLabel,
      value: String(metrics.submissionCount),
    },
  ];

  return (
    <section className="min-w-0 space-y-3">
      <div className="space-y-1">
        <h4 className="font-display text-base font-semibold text-foreground">
          {familyMessages.metrics.heading}
        </h4>
        <p className="text-sm text-muted-foreground">
          {familyMessages.metrics.subtitle}
        </p>
      </div>
      <dl className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="min-w-0 rounded-2xl border border-edge bg-card p-4 shadow-panel"
          >
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {card.label}
            </dt>
            <dd className="mt-1.5 font-display text-xl font-semibold text-foreground tabular-nums wrap-anywhere">
              {card.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function FamilyReportCardItem({ item }: { readonly item: ReportCardItemDto }) {
  const percent = computeScorePercent(item.score, item.maxScore);
  const trimmedFeedback = item.feedback.trim();

  return (
    <li className="min-w-0">
      <article className="grid min-w-0 gap-4 rounded-2xl border border-edge bg-card p-4 text-card-foreground shadow-panel sm:grid-cols-[9.5rem_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col justify-center gap-2 rounded-xl bg-tray px-3 py-3 text-center shadow-inset">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {familyMessages.reportCard.scoreLabel}
          </p>
          <p className="font-display text-2xl leading-none font-semibold text-foreground tabular-nums">
            {item.score} / {item.maxScore}
          </p>
          <p className="text-xs font-semibold text-muted-foreground tabular-nums">
            {familyMessages.reportCard.percentageLabel(percent)}
          </p>
          <div
            role="meter"
            aria-label={familyMessages.reportCard.meterLabel(
              item.score,
              item.maxScore,
            )}
            aria-valuemin={0}
            aria-valuemax={item.maxScore}
            aria-valuenow={item.score}
            className="h-2 overflow-hidden rounded-full bg-edge"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="min-w-0 space-y-2.5">
          <div className="min-w-0 space-y-1.5">
            <h5 className="font-display text-base font-semibold text-foreground wrap-anywhere">
              {item.activityTitle}
            </h5>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {familyMessages.reportCard.typeLabels[item.activityType]}
              </Badge>
              {item.isLate && (
                <Badge variant="outline">
                  {familyMessages.reportCard.lateBadge}
                </Badge>
              )}
            </div>
          </div>

          {trimmedFeedback.length > 0 && (
            <div className="min-w-0 space-y-1 border-t border-edge/60 pt-2.5">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {familyMessages.reportCard.feedbackLabel}
              </p>
              <p className="text-sm text-pretty text-foreground wrap-anywhere">
                {item.feedback}
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {familyMessages.reportCard.gradedAtLabel}{' '}
            <time dateTime={item.gradedAt}>
              {formatGradedInstant(item.gradedAt)}
            </time>
          </p>
        </div>
      </article>
    </li>
  );
}

function FamilyReportCardSection({
  userId,
  link,
}: {
  readonly userId: string;
  readonly link: FamilyLinkDto;
}) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const reconciledErrorRef = useRef<unknown>(null);
  const terminalCleanupRef = useRef<{
    readonly userId: string;
    readonly linkId: string;
  } | null>(null);

  const reportCardQuery = useQuery({
    queryKey: familyReportCardQueryKey(userId, link.id, {
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    }),
    queryFn: ({ signal }) =>
      getFamilyReportCard(
        client,
        link.id,
        { page, pageSize: DEFAULT_PAGE_SIZE },
        { signal },
      ),
  });

  const domainError = isFamilyServiceError(reportCardQuery.error)
    ? reportCardQuery.error
    : null;
  const isAdultModeError =
    reportCardQuery.isError && domainError?.kind === 'adult-mode';
  const isNotFoundError =
    reportCardQuery.isError && domainError?.kind === 'not-found';
  const isTerminalAccessError = isAdultModeError || isNotFoundError;

  useEffect(() => {
    if (!isTerminalAccessError) {
      reconciledErrorRef.current = null;
      terminalCleanupRef.current = null;
      return;
    }
    terminalCleanupRef.current = { userId, linkId: link.id };
    queryClient.removeQueries({
      predicate: createFamilyReportCardPredicate(userId, link.id),
      type: 'inactive',
    });
    if (reconciledErrorRef.current !== reportCardQuery.error) {
      reconciledErrorRef.current = reportCardQuery.error;
      void queryClient.invalidateQueries({
        queryKey: familyLinksQueryKey(userId),
        exact: true,
      });
    }
  }, [
    isTerminalAccessError,
    link.id,
    queryClient,
    reportCardQuery.error,
    userId,
  ]);

  useEffect(() => {
    return () => {
      const cleanup = terminalCleanupRef.current;
      if (cleanup !== null) {
        queryClient.removeQueries({
          predicate: createFamilyReportCardPredicate(
            cleanup.userId,
            cleanup.linkId,
          ),
        });
      }
    };
  }, [queryClient]);

  if (reportCardQuery.isPending) {
    return <LoadingState label={familyMessages.loadingReportCard} />;
  }

  if (isAdultModeError) {
    return (
      <Alert variant="warning" role="status">
        <AlertTitle as="h4">{familyMessages.errors.adultModeTitle}</AlertTitle>
        <AlertDescription>
          {familyMessages.errors.adultModeDescription}
        </AlertDescription>
      </Alert>
    );
  }

  if (isNotFoundError) {
    return (
      <ErrorState
        headingLevel="h4"
        title={familyMessages.errors.notFoundTitle}
        description={familyMessages.errors.notFoundDescription}
      />
    );
  }

  if (reportCardQuery.isError && reportCardQuery.data === undefined) {
    return (
      <ErrorState
        headingLevel="h4"
        title={familyMessages.errors.reportCardTitle}
        description={
          domainError?.userMessage ??
          familyMessages.errors.reportCardDescription
        }
        onRetry={() => void reportCardQuery.refetch()}
        isRetrying={reportCardQuery.isRefetching}
        retryLabel={familyMessages.errors.retryAction}
      />
    );
  }

  const data = reportCardQuery.data;
  if (data === undefined) {
    return null;
  }

  const isOutOfRangePage = data.items.length === 0 && page > 1;

  return (
    <div className="min-w-0 space-y-6">
      {reportCardQuery.isError && (
        <StaleDataNotice
          headingLevel="h4"
          title={familyMessages.errors.reportCardStaleTitle}
          description={familyMessages.errors.reportCardStaleDescription}
          onRetry={() => void reportCardQuery.refetch()}
          isRetrying={reportCardQuery.isRefetching}
          retryLabel={familyMessages.errors.retryAction}
        />
      )}

      <FamilyMetricsGrid metrics={data.metrics} />

      <section className="min-w-0 space-y-4 border-t border-edge/60 pt-5">
        <div className="space-y-1">
          <h4 className="font-display text-base font-semibold text-foreground">
            {familyMessages.reportCard.heading}
          </h4>
          <p className="text-sm text-muted-foreground">
            {familyMessages.reportCard.subtitle}
          </p>
        </div>

        {data.items.length === 0 ? (
          <EmptyState
            headingLevel="h4"
            title={
              isOutOfRangePage
                ? familyMessages.reportCard.emptyPageTitle
                : familyMessages.reportCard.emptyTitle
            }
            description={
              isOutOfRangePage
                ? familyMessages.reportCard.emptyPageDescription
                : familyMessages.reportCard.emptyDescription
            }
            action={
              isOutOfRangePage ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage(1)}
                >
                  {familyMessages.reportCard.backToFirstPage}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="min-w-0 space-y-4">
            <ul
              aria-label={familyMessages.reportCard.listLabel}
              className="min-w-0 space-y-4"
            >
              {data.items.map((item) => (
                <FamilyReportCardItem key={item.activityId} item={item} />
              ))}
            </ul>

            {data.total > data.pageSize && (
              <PaginationControls
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                busy={reportCardQuery.isFetching}
                onPageChange={(nextPage) => setPage(nextPage)}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
