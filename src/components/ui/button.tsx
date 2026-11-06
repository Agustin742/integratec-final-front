import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-input bg-card text-card-foreground',
        ghost: 'text-foreground hover:bg-secondary',
        destructive: 'bg-destructive text-destructive-foreground',
        link: 'text-primary underline underline-offset-4',
      },
      size: {
        default: 'px-4',
        sm: 'px-3',
        lg: 'min-h-12 px-6 text-base',
        icon: 'size-11 shrink-0 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { busy?: boolean };

export function Button({
  className,
  variant,
  size,
  busy = false,
  disabled,
  type = 'button',
  children,
  onClick,
  ...props
}: ButtonProps) {
  const blocked = Boolean(disabled) || busy;

  return (
    <button
      {...props}
      type={type}
      disabled={disabled}
      aria-disabled={blocked ? true : props['aria-disabled']}
      aria-busy={busy || props['aria-busy']}
      onClick={(event) => {
        if (blocked) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={cn(
        buttonVariants({ variant, size }),
        !blocked && 'motion-press',
        className,
      )}
    >
      {busy && (
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
        />
      )}
      {children}
    </button>
  );
}
