import type { ComponentProps, ReactElement } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border p-4 text-sm shadow-panel',
  {
    variants: {
      variant: {
        default: 'border-edge bg-card text-card-foreground',
        destructive: 'border-danger-edge bg-danger text-danger-foreground',
        success: 'border-success-edge bg-success text-success-foreground',
        info: 'border-info-edge bg-info text-info-foreground',
        warning: 'border-warning-edge bg-warning text-warning-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>['variant']>;

// Round icon chip: a darker tone of the hue behind a pale glyph.
const chipTone: Record<AlertVariant, string> = {
  default: 'bg-secondary text-secondary-foreground',
  destructive: 'bg-danger-foreground text-card',
  success: 'bg-success-foreground text-card',
  info: 'bg-info-foreground text-card',
  warning: 'bg-warning-foreground text-card',
};

const chipGlyph: Record<AlertVariant, string> = {
  default: 'M12 11v5M12 8h.01',
  destructive: 'M12 7v6M12 17h.01',
  success: 'm7.5 12.5 3 3 6-6.5',
  info: 'M12 11v5M12 8h.01',
  warning: 'M12 7v6M12 17h.01',
};

function AlertChip({ variant }: { variant: AlertVariant }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 items-center justify-center rounded-full shadow-[0_2px_0_var(--key-raised)]',
        chipTone[variant],
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5 fill-none stroke-current stroke-[2.5]"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={chipGlyph[variant]} />
      </svg>
    </span>
  );
}

export type AlertProps = ComponentProps<'div'> &
  VariantProps<typeof alertVariants>;

export function Alert({
  className,
  variant,
  role,
  children,
  ...props
}: AlertProps) {
  const tone: AlertVariant = variant ?? 'default';

  return (
    <div
      {...props}
      role={role ?? (tone === 'destructive' ? 'alert' : 'status')}
      className={cn(alertVariants({ variant }), className)}
    >
      <AlertChip variant={tone} />
      <div className="min-w-0 pt-1">{children}</div>
    </div>
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
    <Heading
      {...props}
      className={cn('mb-1 font-display text-base font-semibold', className)}
    >
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
