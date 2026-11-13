import { messages } from '../messages';
import { AuthPlaceholderPage } from './auth-placeholder-page';

export function RegisterPage() {
  return <AuthPlaceholderPage {...messages.pages.register} />;
}
