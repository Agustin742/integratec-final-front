import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { messages } from '../messages';

const base =
  'inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2 font-display text-base font-semibold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring';

/** Secondary look; shared with the root fallback, which renders a plain anchor. */
export const homeLinkClass = cn(
  base,
  'bg-secondary text-secondary-foreground [--key:var(--key-secondary)] key-bevel motion-press',
);

const primaryClass = cn(
  base,
  'bg-primary text-primary-foreground [--key:var(--key-primary)] key-bevel motion-press',
);

export type GoHomeLinkProps = {
  className?: string;
  /** `primary` when going home is the main way out, `secondary` next to another main action. */
  variant?: 'primary' | 'secondary';
};

/** Router link back to the start page, styled like a resin-key button. */
export function GoHomeLink({
  className,
  variant = 'primary',
}: GoHomeLinkProps) {
  return (
    <Link
      to="/"
      className={cn(
        variant === 'primary' ? primaryClass : homeLinkClass,
        className,
      )}
    >
      {messages.errors.goHome}
    </Link>
  );
}
