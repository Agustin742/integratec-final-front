import { NotFoundScene } from '@/components/illustrations/scenes';
import { GoHomeLink } from '../router/go-home-link';
import { messages } from '../messages';
import { StatusView } from './status-view';

/**
 * Unknown path, and also what a foreign or missing resource looks like: the
 * copy never says whether the resource exists.
 */
export function NotFoundPage() {
  return (
    <StatusView
      {...messages.pages.notFound}
      scene={<NotFoundScene className="h-auto w-full" />}
      actions={<GoHomeLink />}
    />
  );
}
