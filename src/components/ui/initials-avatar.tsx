import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

const TONES = [
  'bg-[var(--palette-teal)]',
  'bg-[var(--palette-butter)]',
  'bg-[var(--palette-lavender)]',
  'bg-[var(--palette-grass)]',
  'bg-[var(--palette-coral)]',
  'bg-[var(--palette-sand)]',
] as const;

/** Up to two uppercase initials; `?` when the name has no letters. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase('es-AR') || '?';
}

function toneFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return TONES[hash % TONES.length] ?? TONES[0];
}

export interface InitialsAvatarProps {
  readonly name: string;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}

/**
 * Decorative initials disc for people lists. The adjacent name carries the
 * accessible text, so the disc is hidden from assistive technology.
 */
export function InitialsAvatar({
  name,
  size = 'md',
  className,
}: InitialsAvatarProps): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-foreground shadow-inset select-none',
        size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm',
        toneFor(name),
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
