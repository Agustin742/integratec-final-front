import { useId, useState } from 'react';
import { useParams } from 'react-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { DEFAULT_PAGE_SIZE } from '@/components/pagination/pagination';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { formatInstant } from '@/lib/dates';
import { useSessionSnapshot } from '@/session/provider';
import { pointsMessages } from './messages';
import { useStudentWallet, type StudentWallet } from './use-student-wallet';

type PointMovement = StudentWallet['items'][number];

const messages = pointsMessages.wallet.panel;

export interface WalletPanelProps {
  readonly classroomId?: string;
}

/** School-zone date with the roster precedent's raw-ISO fallback. */
function formatMovementDate(isoInstant: string): string {
  try {
    return formatInstant(isoInstant);
  } catch {
    return isoInstant;
  }
}

/**
 * Signed text so the movement direction is never signaled by color alone
 * (`rules/points-and-shop.md`, `rules/ui-and-accessibility.md`).
 */
function formatMovementAmount(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

function MovementItem({ movement }: { readonly movement: PointMovement }) {
  return (
    <li className="min-w-0 space-y-3 rounded-2xl border border-edge bg-card p-4 text-card-foreground shadow-panel">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {messages.dateColumn}
        </p>
        <p className="text-sm text-foreground">
          {formatMovementDate(movement.createdAt)}
        </p>
      </div>
      <div className="min-w-0 space-y-1 border-t border-edge/60 pt-2.5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {messages.reasonColumn}
        </p>
        {/* The server-written reason is rendered verbatim, never reinvented. */}
        <p className="text-sm text-pretty text-foreground wrap-anywhere">
          {movement.reason}
        </p>
      </div>
      <div className="min-w-0 space-y-1 border-t border-edge/60 pt-2.5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {messages.movementColumn}
        </p>
        <p className="font-display text-base font-semibold text-foreground">
          {formatMovementAmount(movement.amount)}
        </p>
      </div>
    </li>
  );
}

/**
 * Read-only student wallet panel (#45, HU-GAM-001): the server-computed
 * balance and one paginated page of movements (date, reason, signed amount).
 * The client never computes, edits, or transfers points; a balance that
 * cannot be retrieved surfaces as an error state, never as zero
 * (`rules/points-and-shop.md`). Rendered inside the indicator's dialog.
 *
 * Keys inner pagination state by `${userId}:${classroomId}` so changing
 * accounts or classrooms resets the page back to 1.
 */
export function WalletPanel({
  classroomId: propClassroomId,
}: WalletPanelProps = {}) {
  // The roster precedent: the id comes from props or the route params.
  const params = useParams<{ classroomId: string }>();
  const resolvedClassroomId = (
    propClassroomId ??
    params.classroomId ??
    ''
  ).trim();
  const snapshot = useSessionSnapshot();
  const userId =
    snapshot.status === 'authenticated' ? snapshot.user.id : 'signed-out';
  const scopeKey = `${userId}:${resolvedClassroomId}`;

  return (
    <WalletPanelContent key={scopeKey} classroomId={resolvedClassroomId} />
  );
}

function WalletPanelContent({ classroomId }: { readonly classroomId: string }) {
  const balanceHeadingId = useId();
  const [page, setPage] = useState(1);
  const wallet = useStudentWallet(classroomId, {
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  if (wallet.status === 'pending') {
    return <LoadingState label={messages.loading} skeletonLines={4} />;
  }
  if (wallet.status === 'error') {
    return (
      <ErrorState
        headingLevel="h3"
        title={messages.errorTitle}
        description={messages.errorDescription}
        onRetry={wallet.retry}
        isRetrying={wallet.isFetching}
        retryLabel={messages.retryAction}
      />
    );
  }

  const { wallet: data, meta, stale, retry, isFetching } = wallet;
  const isOutOfRangeEmpty = data.total > 0 && data.items.length === 0;

  return (
    <section aria-labelledby={balanceHeadingId} className="min-w-0 space-y-5">
      <div className="min-w-0 space-y-1">
        <p
          id={balanceHeadingId}
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {messages.balanceLabel}
        </p>
        <p className="font-display text-3xl font-semibold text-foreground">
          {messages.balanceValue(data.balance)}
        </p>
      </div>

      {stale && (
        <StaleDataNotice
          headingLevel="h3"
          title={messages.staleTitle}
          description={messages.staleDescription}
          onRetry={retry}
          isRetrying={isFetching}
        />
      )}

      {data.items.length === 0 ? (
        <EmptyState
          headingLevel="h3"
          title={
            isOutOfRangeEmpty ? messages.emptyPageTitle : messages.emptyTitle
          }
          description={
            isOutOfRangeEmpty
              ? messages.emptyPageDescription
              : messages.emptyDescription
          }
        />
      ) : (
        <ul className="min-w-0 space-y-3" aria-label={messages.listLabel}>
          {data.items.map((movement) => (
            <MovementItem key={movement.id} movement={movement} />
          ))}
        </ul>
      )}

      {meta.total > 0 && (
        <PaginationControls
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          onPageChange={setPage}
          busy={isFetching}
        />
      )}
    </section>
  );
}
