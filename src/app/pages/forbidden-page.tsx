import { GoHomeLink } from '../router/go-home-link';
import { messages } from '../messages';
import { PlaceholderPage } from './placeholder-page';

/** Insufficient role inside a resource the user can reach (not a login problem). */
export function ForbiddenPage() {
  return (
    <PlaceholderPage {...messages.pages.forbidden}>
      <GoHomeLink />
    </PlaceholderPage>
  );
}
