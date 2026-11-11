import { useId, type ReactNode } from 'react';
import { useDocumentTitle } from '../router/document-title';

export type StatusViewProps = {
  /** Decorative scene (`aria-hidden`); the text carries the whole message. */
  scene: ReactNode;
  title: string;
  description: string;
  /** Primary action first. */
  actions: ReactNode;
  /** `alert` for failures that appear without the user asking for them. */
  role?: 'alert';
};

/**
 * Shared body of the not found, forbidden and error views: a small classroom
 * scene, a friendly `h2`, a short explanation and the next steps. It takes the
 * width of whatever layout hosts it (the shell, or the auth form column) and
 * centers itself, so the same view works in both.
 */
export function StatusView({
  scene,
  title,
  description,
  actions,
  role,
}: StatusViewProps) {
  const titleId = useId();
  useDocumentTitle(title);

  return (
    <section
      role={role}
      aria-labelledby={titleId}
      className="mx-auto flex w-full max-w-xl animate-fade-in flex-col items-center gap-6 py-4 text-center sm:py-10"
    >
      <div className="w-full max-w-60 sm:max-w-72">{scene}</div>
      <div className="space-y-3">
        <h2 id={titleId} className="text-3xl text-balance sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto max-w-prose text-pretty text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">{actions}</div>
    </section>
  );
}
