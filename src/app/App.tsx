import { BaseLayout } from '../components/layout/base-layout';
import { Toast } from '../components/ui/toast';
import { messages } from './messages';
import { UiFoundations } from './ui-foundations';

export function App() {
  return (
    <>
      <BaseLayout
        header={<p className="font-semibold">{messages.title}</p>}
        sidebarLabel={messages.showcase.navigation}
        sidebar={
          <a
            href="#ui-foundations"
            className="rounded-sm underline underline-offset-4"
          >
            {messages.showcase.title}
          </a>
        }
      >
        <div className="space-y-2">
          <h1>{messages.title}</h1>
          <p>{messages.bootstrapReady}</p>
        </div>
        <UiFoundations />
      </BaseLayout>
      <Toast />
    </>
  );
}
