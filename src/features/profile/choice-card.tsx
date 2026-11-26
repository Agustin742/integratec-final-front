import { cn } from '@/lib/utils';

/**
 * Look shared by every picture choice of the profile (base styles and classroom
 * accessories): the chosen one has a thick primary frame, a check on its
 * picture and a filled strip with a word, so it never relies on color alone.
 */
export function choiceCardClass({
  selected,
  locked = false,
}: {
  readonly selected: boolean;
  readonly locked?: boolean;
}): string {
  return cn(
    'motion-colors relative flex min-w-0 flex-col overflow-hidden rounded-2xl border-[3px] text-center text-foreground',
    selected
      ? 'border-primary bg-success shadow-raised'
      : locked
        ? 'border-dashed border-field-border bg-tray/40'
        : 'border-edge bg-card hover:border-field-border hover:bg-tray-hover',
  );
}

export const CHOICE_GRID_CLASS =
  'grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2';

export function CheckGlyph({ className }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      className={cn('size-4 shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 8.5 3.2 3.2L13 4.8" />
    </svg>
  );
}

export function LockGlyph({ className }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      className={cn('size-4 shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

/** Round corner mark over a card's picture. */
export function CornerMark({ kind }: { readonly kind: 'selected' | 'locked' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full border-2',
        kind === 'selected'
          ? 'border-card bg-primary text-primary-foreground'
          : 'border-field-border bg-card text-foreground',
      )}
    >
      {kind === 'selected' ? (
        <CheckGlyph className="size-3.5" />
      ) : (
        <LockGlyph className="size-3.5" />
      )}
    </span>
  );
}
