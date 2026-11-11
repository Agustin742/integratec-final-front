import { useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { layoutMessages } from './messages';
import { SkipLink } from './skip-link';

export type BaseLayoutProps = {
  header: ReactNode;
  children: ReactNode;
  sidebar?: ReactNode;
  sidebarLabel?: string;
  mainId?: string;
  className?: string;
};

export function BaseLayout({
  header,
  children,
  sidebar,
  sidebarLabel = layoutMessages.sidebar,
  mainId,
  className,
}: BaseLayoutProps) {
  const generatedId = useId();
  const contentId = mainId ?? generatedId;
  const mainRef = useRef<HTMLElement>(null);
  const hasSidebar = sidebar != null && sidebar !== false;

  return (
    <div
      className={cn(
        'min-h-dvh min-w-0 bg-background text-foreground [overflow-wrap:anywhere]',
        className,
      )}
    >
      <SkipLink
        targetId={contentId}
        onActivate={() => mainRef.current?.focus()}
      />
      <header className="border-b border-edge bg-card text-card-foreground shadow-panel">
        <div className="mx-auto w-full max-w-6xl min-w-0 px-4 py-4 sm:px-6">
          {header}
        </div>
      </header>
      <div
        className={cn(
          'mx-auto grid w-full max-w-6xl min-w-0 gap-6 px-4 py-6 sm:px-6 lg:gap-8',
          hasSidebar && 'lg:grid-cols-[15rem_minmax(0,1fr)]',
        )}
      >
        {hasSidebar && (
          <aside
            aria-label={sidebarLabel}
            className="min-w-0 self-start rounded-2xl border border-edge bg-card p-3 text-card-foreground shadow-panel lg:sticky lg:top-6"
          >
            {sidebar}
          </aside>
        )}
        <main
          id={contentId}
          ref={mainRef}
          tabIndex={-1}
          className="min-w-0 space-y-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
