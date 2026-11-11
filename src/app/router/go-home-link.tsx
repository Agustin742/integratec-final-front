import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { messages } from '../messages';

/** Shared with the root fallback, which renders a plain anchor instead of a router link. */
export const homeLinkClass =
  'inline-flex min-h-11 items-center rounded-xl bg-secondary px-5 py-2 font-display text-base font-semibold text-secondary-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring';

/** Router link back to the start page, styled like the secondary button. */
export function GoHomeLink({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn(homeLinkClass, className)}>
      {messages.errors.goHome}
    </Link>
  );
}
