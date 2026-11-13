import { useRef } from 'react';
import { Outlet } from 'react-router';
import { SkipLink } from '@/components/layout/skip-link';
import { Toast } from '@/components/ui/toast';
import { messages } from '../messages';
import { MAIN_CONTENT_ID } from './focus-on-navigation';

/**
 * Layout route for the signed-out pages (login, register, password reset and
 * invitation acceptance): a split screen with no navigation.
 *
 * The brand panel comes first in the DOM, so on a phone it stacks above the
 * content and on a wide screen it sits on the right. It only holds a heading
 * and a placeholder for the 3D classroom model, so nothing in it needs a tab stop and the skip link
 * jumps straight to `main`. The `h1` is the product name, as in the shell;
 * pages keep `h2` for their own title.
 *
 * `[data-auth-slot]` is the form column: the feature screens (#27, #28, #31)
 * render their form inside it and inherit its width and surface.
 */
export function AuthLayout() {
  const mainRef = useRef<HTMLElement>(null);

  return (
    <>
      <div className="min-h-dvh min-w-0 bg-background text-foreground [overflow-wrap:anywhere] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <SkipLink
          targetId={MAIN_CONTENT_ID}
          onActivate={() => mainRef.current?.focus()}
        />
        <header className="flex min-w-0 flex-col items-center gap-4 rounded-b-[2rem] bg-primary px-6 pt-6 pb-7 text-center text-primary-foreground sm:gap-5 sm:px-10 lg:col-start-2 lg:row-start-1 lg:justify-center lg:gap-10 lg:rounded-s-[3rem] lg:rounded-e-none lg:px-14 lg:py-12">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              {messages.title}
            </h1>
            <p className="mx-auto max-w-md text-base text-pretty lg:text-lg">
              {messages.auth.tagline}
            </p>
          </div>
          {/* Placeholder until the 3D classroom model is available. */}
          <p
            data-classroom-placeholder
            className="flex aspect-[16/9] w-full max-w-2xl items-center justify-center rounded-3xl border-2 border-dashed border-primary-foreground/40 px-6 text-center text-base font-medium text-primary-foreground/80"
          >
            {messages.auth.classroomPlaceholder}
          </p>
        </header>
        <main
          id={MAIN_CONTENT_ID}
          ref={mainRef}
          tabIndex={-1}
          className="flex min-w-0 items-center justify-center px-4 py-8 sm:px-10 lg:col-start-1 lg:row-start-1 lg:py-12"
        >
          <div
            data-auth-slot
            className="w-full max-w-md min-w-0 rounded-3xl border border-edge bg-card p-6 text-card-foreground shadow-float sm:p-8"
          >
            <Outlet />
          </div>
        </main>
      </div>
      <Toast />
    </>
  );
}
