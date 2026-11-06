import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({
  className,
  ...props
}: Omit<ComponentProps<'div'>, 'children'>) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn(
        'rounded-xl bg-tray bg-[linear-gradient(90deg,var(--tray)_30%,var(--tray-hover)_50%,var(--tray)_70%)] bg-[length:200%_100%] motion-safe:animate-shimmer',
        className,
      )}
    />
  );
}
