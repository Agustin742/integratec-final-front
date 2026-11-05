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
        'rounded-md bg-secondary motion-safe:animate-pulse',
        className,
      )}
    />
  );
}
