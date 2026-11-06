import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type TableProps = ComponentProps<'table'> & { containerLabel: string };

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The named overflow region must be focusable for keyboard scrolling. */
export function Table({ className, containerLabel, ...props }: TableProps) {
  return (
    <div
      role="region"
      aria-label={containerLabel}
      tabIndex={0}
      className="w-full min-w-0 overflow-x-auto rounded-2xl border border-edge bg-card shadow-panel focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
    >
      <table
        {...props}
        className={cn(
          'w-full caption-bottom text-left text-sm text-foreground',
          className,
        )}
      />
    </div>
  );
}

/* eslint-enable jsx-a11y/no-noninteractive-tabindex */

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return (
    <thead
      {...props}
      className={cn(
        'bg-secondary font-display text-secondary-foreground [&_tr]:border-b [&_tr]:border-edge',
        className,
      )}
    />
  );
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return (
    <tbody
      {...props}
      className={cn(
        'bg-card text-card-foreground [&_tr:last-child]:border-0',
        className,
      )}
    />
  );
}

export function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
  return (
    <tfoot
      {...props}
      className={cn(
        'border-t border-edge bg-muted font-medium text-foreground',
        className,
      )}
    />
  );
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      {...props}
      className={cn(
        'motion-colors border-b border-edge hover:bg-row-hover',
        className,
      )}
    />
  );
}

export function TableHead({
  className,
  scope = 'col',
  ...props
}: ComponentProps<'th'>) {
  return (
    <th
      {...props}
      scope={scope}
      className={cn(
        'px-5 py-3.5 text-left align-middle font-semibold',
        className,
      )}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td {...props} className={cn('px-5 py-4 align-middle', className)} />;
}

export function TableCaption({
  className,
  ...props
}: ComponentProps<'caption'>) {
  return (
    <caption
      {...props}
      className={cn('py-3 text-sm text-muted-foreground', className)}
    />
  );
}
