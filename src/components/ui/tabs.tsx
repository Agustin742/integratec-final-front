import type { ComponentProps, ReactElement } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export function Tabs({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Root>): ReactElement {
  return <TabsPrimitive.Root className={cn('min-w-0', className)} {...props} />;
}

export function TabsList({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>): ReactElement {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-tray p-1.5 text-muted-foreground shadow-inset data-[orientation=vertical]:flex-col',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>): ReactElement {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'motion-colors inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl px-4 py-2 font-display text-base font-medium hover:bg-tray-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 data-[state=active]:bg-card data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-raised',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>): ReactElement {
  return (
    <TabsPrimitive.Content
      className={cn(
        'mt-4 min-w-0 rounded-xl data-[state=active]:animate-fade-in',
        className,
      )}
      {...props}
    />
  );
}
