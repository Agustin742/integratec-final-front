import { useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { layoutMessages } from './messages';

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
      <a
        href={`#${contentId}`}
        onClick={() => mainRef.current?.focus()}
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        {layoutMessages.skipToContent}
      </a>
      <header className="border-b bg-card text-card-foreground">
        <div className="mx-auto w-full max-w-6xl min-w-0 px-4 py-4 sm:px-6">
          {header}
        </div>
      </header>
      <div
        className={cn(
          'mx-auto grid w-full max-w-6xl min-w-0 gap-6 px-4 py-6 sm:px-6',
          hasSidebar && 'lg:grid-cols-[14rem_minmax(0,1fr)]',
        )}
      >
        {hasSidebar && (
          <aside
            aria-label={sidebarLabel}
            className="min-w-0 rounded-lg border bg-card p-4 text-card-foreground shadow-panel"
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
