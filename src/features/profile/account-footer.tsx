import { StreakSummary } from '@/features/points/streak-summary';
import { profileMessages } from './messages';

const copy = profileMessages.page;

/** Secondary account facts, small and last: streak and read-only email. */
export function AccountFooter({ email }: { readonly email: string }) {
  return (
    <section
      aria-label={copy.footerLabel}
      className="space-y-3 border-t border-edge pt-4 text-sm text-muted-foreground"
    >
      <StreakSummary />
      <p>
        {copy.emailLabel}:{' '}
        <span className="font-semibold text-foreground">{email}</span>.{' '}
        {copy.emailNote}
      </p>
    </section>
  );
}
