import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export type InputProps = ComponentProps<'input'>;

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      {...props}
      type={type}
      className={cn(
        'min-h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base text-card-foreground placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive',
        className,
      )}
    />
  );
}
