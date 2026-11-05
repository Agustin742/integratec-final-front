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
        'flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-secondary p-1 text-secondary-foreground data-[orientation=vertical]:flex-col',
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
        'inline-flex min-h-9 shrink-0 items-center justify-center rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 data-[state=active]:bg-card data-[state=active]:font-semibold data-[state=active]:text-card-foreground data-[state=active]:underline data-[state=active]:underline-offset-4 data-[state=active]:shadow-panel',
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
      className={cn('mt-3 min-w-0 rounded-md', className)}
      {...props}
    />
  );
}
