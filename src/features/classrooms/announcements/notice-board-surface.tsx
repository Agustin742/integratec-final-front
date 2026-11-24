import type { ReactElement, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { announcementMessages } from './messages';

/**
 * The board itself: a recessed sand "cork" tray the paper notes sit on. It is
 * the one thing that gives Avisos its own identity next to the flat Activities
 * rows and the Material modules (tokens only: tray + inset well).
 */
export function NoticeBoardSurface({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <div
      className={cn(
        'min-w-0 rounded-3xl bg-tray px-3 pt-8 pb-6 shadow-inset sm:px-6 sm:pt-9',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Pin glyph shared by the empty board (decorative). */
function PinIcon(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="mx-auto size-10 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 4h6l-1 6 3 3H7l3-3-1-6Z" />
      <path d="M12 13v7" />
    </svg>
  );
}

export function NoticeBoardEmpty({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}): ReactElement {
  return (
    <NoticeBoardSurface>
      <section
        aria-labelledby="notice-board-empty-title"
        data-state-kind="empty"
        className="mx-auto max-w-md space-y-2 rounded-2xl border border-dashed border-border bg-card px-6 py-8 text-center shadow-ambient"
      >
        <PinIcon />
        <h4
          id="notice-board-empty-title"
          className="font-display text-lg font-semibold text-foreground"
        >
          {title}
        </h4>
        <p className="text-sm text-muted-foreground">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </section>
    </NoticeBoardSurface>
  );
}

/** Loading placeholder shaped like the notes it will become. */
export function NoticeBoardLoading(): ReactElement {
  return (
    <NoticeBoardSurface>
      <p
        role="status"
        aria-live="polite"
        className="mb-5 font-display text-sm font-semibold text-foreground"
      >
        {announcementMessages.loadingTitle}
      </p>
      <div
        aria-hidden="true"
        data-loading-placeholder="true"
        className="space-y-7"
      >
        {[0, 1].map((index) => (
          <div
            key={index}
            className="space-y-4 rounded-2xl border border-edge bg-card px-4 py-5 shadow-ambient sm:px-7"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-5 w-2/3" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        ))}
      </div>
    </NoticeBoardSurface>
  );
}
