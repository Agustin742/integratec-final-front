import type { ComponentProps, ReactElement } from 'react';
import { DropdownMenu as MenuPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

/**
 * Accessible action menu on Radix: the trigger exposes `aria-haspopup="menu"`,
 * arrow keys / Home / End move focus, Escape closes, and focus returns to the
 * trigger unless the caller moves it elsewhere in `onCloseAutoFocus`.
 */
export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>): ReactElement {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={12}
        className={cn(
          'z-[70] min-w-44 overflow-hidden rounded-2xl border border-edge bg-popover p-1.5 text-popover-foreground shadow-float data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  tone = 'default',
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> & {
  tone?: 'default' | 'destructive';
}): ReactElement {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 font-display text-sm font-semibold outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[highlighted]:bg-tray',
        tone === 'destructive' &&
          'text-destructive data-[highlighted]:bg-danger',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>): ReactElement {
  return (
    <MenuPrimitive.Separator
      className={cn('my-1 h-px bg-edge', className)}
      {...props}
    />
  );
}
