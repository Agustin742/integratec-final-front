import { messages } from '../messages';
import { PlaceholderPage } from './placeholder-page';

export function NotFoundPage() {
  return <PlaceholderPage {...messages.pages.notFound} />;
}
