import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2 font-display text-base font-semibold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        default:
          '[--key:var(--key-primary)] bg-primary text-primary-foreground',
        secondary:
          '[--key:var(--key-secondary)] bg-secondary text-secondary-foreground',
        outline:
          '[--key:var(--key-sand)] border-2 border-edge bg-card text-card-foreground',
        ghost: 'text-foreground hover:bg-tray',
        destructive:
          '[--key:var(--key-destructive)] bg-destructive text-destructive-foreground',
        link: 'rounded-md text-primary underline underline-offset-4',
      },
      size: {
        default: '',
        sm: 'px-4 text-sm',
        lg: 'min-h-12 px-7 text-lg',
        icon: 'size-11 shrink-0 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

// Variants that render as a raised resin key; ghost and link stay flat.
const bevelledVariants = new Set([
  'default',
  'secondary',
  'outline',
  'destructive',
]);

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
  const bevelled = !disabled && bevelledVariants.has(variant ?? 'default');

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
        bevelled && 'key-bevel',
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
