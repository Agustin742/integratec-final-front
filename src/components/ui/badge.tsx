import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border-0 px-3 py-1 font-display text-sm leading-tight font-semibold shadow-[0_2px_0_var(--bevel)]',
  {
    variants: {
      variant: {
        default:
          '[--bevel:var(--key-primary)] bg-primary text-primary-foreground',
        secondary:
          '[--bevel:var(--key-secondary)] bg-secondary text-secondary-foreground',
        destructive:
          '[--bevel:var(--key-destructive)] bg-destructive text-destructive-foreground',
        outline:
          '[--bevel:var(--key-sand)] border-2 border-edge bg-card text-card-foreground',
        success:
          '[--bevel:var(--success-edge)] bg-success text-success-foreground',
        info: '[--bevel:var(--info-edge)] bg-info text-info-foreground',
        warning:
          '[--bevel:var(--warning-edge)] bg-warning text-warning-foreground',
        danger: '[--bevel:var(--danger-edge)] bg-danger text-danger-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type BadgeProps = ComponentProps<'span'> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span {...props} className={cn(badgeVariants({ variant }), className)} />
  );
}
