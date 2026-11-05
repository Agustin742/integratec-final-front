import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

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

export type AlertTitleProps = ComponentProps<'h2'> & {
  as?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
};

export function AlertTitle({
  as: Heading = 'h2',
  className,
  children,
  ...props
}: AlertTitleProps) {
  return (
    <Heading {...props} className={cn('mb-1 font-semibold', className)}>
      {children}
    </Heading>
  );
}

export function AlertDescription({
  className,
  ...props
}: ComponentProps<'div'>) {
  return <div {...props} className={cn('leading-relaxed', className)} />;
}
