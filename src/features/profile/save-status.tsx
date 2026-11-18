import { Badge } from '@/components/ui/badge';
import { LiveRegion } from '@/components/feedback/states';
import { profileMessages } from './messages';

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'failed';

const VARIANT = {
  saved: 'success',
  unsaved: 'warning',
  saving: 'info',
  failed: 'destructive',
} as const;

export interface SaveStatusBadgeProps {
  readonly status: SaveStatus;
  /** Result announced to assistive technology once an operation settles. */
  readonly announcement?: string;
}

/**
 * Distinguishes a saved value, an unsaved draft, a pending write and a failed
 * write with text (never color alone), and announces settled results
 * (`rules/avatars-and-customization.md`, `rules/ui-and-accessibility.md`).
 */
export function SaveStatusBadge({
  status,
  announcement,
}: SaveStatusBadgeProps) {
  return (
    <>
      <Badge variant={VARIANT[status]} data-save-status={status}>
        {profileMessages.status[status]}
      </Badge>
      <LiveRegion
        message={announcement ?? ''}
        className="font-semibold text-foreground"
      />
    </>
  );
}
