import { useId, type ReactNode } from 'react';

export interface SettingsSectionProps {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}

/** Two columns on wide panels (what it is | its controls), stacked on phones. */
export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-4 border-b border-edge py-6 first:pt-2 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8"
    >
      <div className="space-y-1">
        <h3
          id={headingId}
          className="font-display text-lg font-semibold text-foreground"
        >
          {title}
        </h3>
        <p className="text-sm text-pretty text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}
