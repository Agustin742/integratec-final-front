import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const alertVariants = cva('rounded-lg border p-4 text-sm shadow-panel', {
  variants: {
    variant: {
      default: 'border-border bg-card text-card-foreground',
      destructive: 'border-destructive bg-card text-destructive',
    },
  },
  defaultVariants: { variant: 'default' },
});

export type AlertProps = ComponentProps<'div'> &
  VariantProps<typeof alertVariants>;

export function Alert({ className, variant, role, ...props }: AlertProps) {
  return (
    <div
      {...props}
      role={role ?? (variant === 'destructive' ? 'alert' : 'status')}
      className={cn(alertVariants({ variant }), className)}
    />
  );
}

export function AlertTitle({
  className,
  children,
  ...props
}: ComponentProps<'h2'>) {
  return (
    <h2 {...props} className={cn('mb-1 font-semibold', className)}>
      {children}
    </h2>
  );
}

export function AlertDescription({
  className,
  ...props
}: ComponentProps<'div'>) {
  return <div {...props} className={cn('leading-relaxed', className)} />;
}
