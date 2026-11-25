import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import type { ActivityType } from './activity-schema';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/**
 * Decorative tile that tells a trabajo practico (sheet with lines) from an
 * exam (clipboard with a check) at a glance. The type is always also written
 * as text next to it, so the icon never carries meaning alone.
 */
export function ActivityTypeIcon({
  type,
  className,
}: {
  readonly type: ActivityType;
  readonly className?: string;
}): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-12 shrink-0 items-center justify-center rounded-2xl',
        type === 'EXAM'
          ? 'bg-warning text-warning-foreground'
          : 'bg-info text-info-foreground',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-6" {...stroke}>
        {type === 'EXAM' ? (
          <>
            <rect x="5" y="4" width="14" height="17" rx="2.5" />
            <path d="M9 4.5h6M9 13l2 2 4-4.5" />
          </>
        ) : (
          <>
            <path d="M7 3h7l4 4v12.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5v-15A1.5 1.5 0 0 1 7 3Z" />
            <path d="M14 3v4h4M9 12h6M9 16h4" />
          </>
        )}
      </svg>
    </span>
  );
}
