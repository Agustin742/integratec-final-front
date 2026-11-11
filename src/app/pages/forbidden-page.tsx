import { ForbiddenScene } from '@/components/illustrations/scenes';
import { GoHomeLink } from '../router/go-home-link';
import { messages } from '../messages';
import { StatusView } from './status-view';

/** Insufficient role inside a resource the user can reach (not a login problem). */
export function ForbiddenPage() {
  return (
    <StatusView
      {...messages.pages.forbidden}
      scene={<ForbiddenScene className="h-auto w-full" />}
      actions={<GoHomeLink />}
    />
  );
}
