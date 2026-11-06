import { Suspense, lazy } from 'react';
import { BaseLayout } from '@/components/layout/base-layout';
import { SidebarNav, SidebarNavItem } from '@/components/layout/sidebar-nav';
import { Toast } from '@/components/ui/toast';
import { messages } from './messages';

/**
 * The component showcase is a development aid. It is rendered by the dev server
 * and by the `showcase` build mode used by the browser suite; production builds
 * resolve the constant to false and drop the lazy chunk entirely.
 */
export const showcaseEnabled = __UI_SHOWCASE__;

const Showcase = showcaseEnabled
  ? lazy(() =>
      import('./ui-foundations').then((module) => ({
        default: module.UiFoundations,
      })),
    )
  : null;

export function App() {
  return (
    <>
      <BaseLayout
        header={
          <h1 className="text-2xl font-bold text-primary">{messages.title}</h1>
        }
        sidebarLabel={
          showcaseEnabled ? messages.showcase.navigation : undefined
        }
        sidebar={
          showcaseEnabled ? (
            <SidebarNav>
              <SidebarNavItem href="#ui-foundations" current>
                {messages.showcase.title}
              </SidebarNavItem>
            </SidebarNav>
          ) : undefined
        }
      >
        <p>{messages.bootstrapReady}</p>
        {Showcase && (
          <Suspense fallback={null}>
            <Showcase />
          </Suspense>
        )}
      </BaseLayout>
      <Toast />
    </>
  );
}
