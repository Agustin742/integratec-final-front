import { GoHomeLink } from '../router/go-home-link';
import { messages } from '../messages';
import { PlaceholderPage } from './placeholder-page';

/**
 * Unknown path, and also what a foreign or missing resource looks like: the
 * copy never says whether the resource exists.
 */
export function NotFoundPage() {
  return (
    <PlaceholderPage {...messages.pages.notFound}>
      <GoHomeLink />
    </PlaceholderPage>
  );
}
