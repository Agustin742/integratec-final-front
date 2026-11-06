import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type InputProps = ComponentProps<'input'>;

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      {...props}
      type={type}
      className={cn(
        'motion-field min-h-11 w-full min-w-0 rounded-xl border-2 border-field-border bg-card px-4 py-2 text-base text-card-foreground shadow-inset placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive',
        className,
      )}
    />
  );
}
