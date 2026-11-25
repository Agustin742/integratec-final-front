import { useRef, type ReactElement, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { buttonStyles } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ActivityListItemDto } from './activity-schema';
import { ActivityTypeIcon } from './activity-type-icon';
import {
  formatActivityDeadline,
  formatActivityRelativeDue,
} from './format-activity-deadline';
import { activityMessages } from './messages';

const copy = activityMessages;

type BadgeVariant = 'outline' | 'success' | 'warning' | 'danger' | 'info';

export interface ActivityRowProps {
  readonly item: ActivityListItemDto;
  readonly classroomId: string;
  readonly isStaff: boolean;
  /** Epoch ms used only to phrase and group deadlines. */
  readonly now: number;
  /** Disables the overflow menu while an action is in flight or confirming. */
  readonly menuDisabled: boolean;
  readonly registerMenuTrigger: (node: HTMLButtonElement | null) => void;
  readonly onEdit: (item: ActivityListItemDto) => void;
  readonly onPublish: (item: ActivityListItemDto) => void;
  readonly onDeactivate: (item: ActivityListItemDto) => void;
  /** Inline destructive confirmation rendered under the row. */
  readonly children?: ReactNode;
}

function statusBadge(
  item: ActivityListItemDto,
  isStaff: boolean,
  now: number,
): { label: string; variant: BadgeVariant } {
  if (isStaff) {
    if (item.state === 'DRAFT') {
      return { label: copy.board.teacherStatus.DRAFT, variant: 'outline' };
    }
    return Date.parse(item.dueAt) < now
      ? { label: copy.board.teacherStatus.closed, variant: 'warning' }
      : { label: copy.board.teacherStatus.PUBLISHED, variant: 'success' };
  }
  switch (item.status) {
    case 'graded':
      return { label: copy.board.workStatus.graded, variant: 'success' };
    case 'submitted':
      return { label: copy.board.workStatus.submitted, variant: 'info' };
    case 'overdue':
      return { label: copy.board.workStatus.overdue, variant: 'danger' };
    case 'pending':
      return { label: copy.board.workStatus.pending, variant: 'warning' };
    default:
      return { label: copy.board.teacherStatus.PUBLISHED, variant: 'success' };
  }
}

export function ActivityRow({
  item,
  classroomId,
  isStaff,
  now,
  menuDisabled,
  registerMenuTrigger,
  onEdit,
  onPublish,
  onDeactivate,
  children,
}: ActivityRowProps): ReactElement {
  // A menu action opens a dialog or confirmation that owns focus next. It runs
  // only once the menu has unmounted (its focus trap would otherwise steal
  // focus back), and the menu then must not return focus to its trigger.
  const pendingActionRef = useRef<(() => void) | null>(null);
  const badge = statusBadge(item, isStaff, now);
  const detailHref = `/classrooms/${encodeURIComponent(classroomId)}/activities/${encodeURIComponent(item.id)}`;

  return (
    <li className="min-w-0">
      <div className="group/row relative flex min-w-0 items-start gap-3.5 px-4 py-4 transition-colors focus-within:bg-row-hover hover:bg-row-hover sm:gap-4 sm:px-5 sm:py-5">
        <ActivityTypeIcon type={item.type} />

        <div className="min-w-0 flex-1 space-y-1.5">
          <h5 className="font-display text-base leading-snug font-semibold text-foreground sm:text-lg">
            <Link
              to={detailHref}
              aria-label={`${copy.openDetailLabel}: ${item.title}`}
              className="rounded-md break-words outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-xl focus-visible:after:outline-3 focus-visible:after:-outline-offset-3 focus-visible:after:outline-ring"
            >
              {item.title}
            </Link>
          </h5>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {copy.typeLabels[item.type]}
            </span>
            <span>{copy.formatLabels[item.format]}</span>
            {item.format === 'MULTIPLE_CHOICE' ? (
              <span>{copy.questionCountLabel(item.questionCount)}</span>
            ) : null}
            <span>{copy.board.scoreLabel(item.maxScore)}</span>
          </p>

          {item.description ? (
            <p className="line-clamp-1 text-sm break-words text-muted-foreground">
              {item.description}
            </p>
          ) : null}

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-sm text-muted-foreground">
            <Badge variant={badge.variant} className="px-2.5 py-0.5 text-xs">
              {badge.label}
            </Badge>
            <span>
              {copy.dueAtLabel}{' '}
              <span className="font-semibold text-foreground">
                {formatActivityRelativeDue(item.dueAt, now)}
              </span>
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            <time dateTime={item.dueAt}>
              {formatActivityDeadline(item.dueAt, item.timeZone)}
            </time>
          </p>
          {item.opensAt !== null ? (
            <p className="text-xs text-muted-foreground">
              {copy.opensAtLabel}{' '}
              <time dateTime={item.opensAt}>
                {formatActivityDeadline(item.opensAt, item.timeZone)}
              </time>
            </p>
          ) : null}
        </div>

        {isStaff ? (
          <div className="relative z-10 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  ref={registerMenuTrigger}
                  type="button"
                  disabled={menuDisabled}
                  aria-label={copy.board.moreActionsAriaLabel(item.title)}
                  className={buttonStyles({
                    variant: 'outline',
                    size: 'icon',
                    disabled: menuDisabled,
                  })}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="currentColor"
                  >
                    <circle cx="5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="19" cy="12" r="1.8" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                onCloseAutoFocus={(event) => {
                  const pending = pendingActionRef.current;
                  if (pending) {
                    pendingActionRef.current = null;
                    event.preventDefault();
                    pending();
                  }
                }}
              >
                <DropdownMenuItem
                  onSelect={() => {
                    pendingActionRef.current = () => onEdit(item);
                  }}
                >
                  {copy.actions.editAction}
                </DropdownMenuItem>
                {item.state === 'DRAFT' ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      pendingActionRef.current = () => onPublish(item);
                    }}
                  >
                    {copy.actions.publishAction}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  tone="destructive"
                  onSelect={() => {
                    pendingActionRef.current = () => onDeactivate(item);
                  }}
                >
                  {copy.actions.deactivateAction}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="mt-3 size-5 shrink-0 text-muted-foreground transition-transform group-hover/row:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        )}
      </div>
      {children ? (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
      ) : null}
    </li>
  );
}
