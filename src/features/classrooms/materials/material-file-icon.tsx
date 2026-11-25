import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import type { MaterialContentType } from './material-schema';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/**
 * Decorative tile that tells a PDF (sheet) from an image (picture) at a glance.
 * The type is always also written as text next to the file, so the icon never
 * carries meaning alone.
 */
export function MaterialFileIcon({
  contentType,
  className,
}: {
  readonly contentType: MaterialContentType;
  readonly className?: string;
}): ReactElement {
  const isPdf = contentType === 'application/pdf';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-2xl',
        isPdf
          ? 'bg-danger text-danger-foreground'
          : 'bg-info text-info-foreground',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-6" {...stroke}>
        {isPdf ? (
          <>
            <path d="M7 3h7l4 4v12.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5v-15A1.5 1.5 0 0 1 7 3Z" />
            <path d="M14 3v4h4M9 12h6M9 16h4" />
          </>
        ) : (
          <>
            <rect x="4" y="5" width="16" height="14" rx="2.5" />
            <circle cx="9" cy="10" r="1.6" />
            <path d="m20 16-4.5-4.5L8 19" />
          </>
        )}
      </svg>
    </span>
  );
}
