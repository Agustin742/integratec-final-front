import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function SidebarNav({ className, ...props }: ComponentProps<'ul'>) {
  return (
    <ul {...props} className={cn('m-0 grid list-none gap-2 p-0', className)} />
  );
}

export type SidebarNavItemProps = ComponentProps<'a'> & {
  /** Marks the item for the current location; shape and weight change too, not only color. */
  current?: boolean;
};

export function SidebarNavItem({
  current = false,
  className,
  children,
  ...props
}: SidebarNavItemProps) {
  return (
    <li>
      <a
        {...props}
        aria-current={current ? 'page' : undefined}
        className={cn(
          'motion-colors flex min-h-11 items-center gap-3 rounded-xl px-4 py-2 font-display text-base focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring',
          current
            ? 'bg-card font-semibold text-foreground shadow-raised before:size-2.5 before:shrink-0 before:rounded-full before:bg-primary'
            : 'font-medium text-muted-foreground hover:bg-tray-hover hover:text-foreground',
          className,
        )}
      >
        {children}
      </a>
    </li>
  );
}
