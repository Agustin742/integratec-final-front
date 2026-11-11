import type { ReactNode } from 'react';
import { useDocumentTitle } from '../router/document-title';

export type PlaceholderPageProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

/**
 * Minimal page body for routes whose feature screen is delivered by a later
 * story. The shell header owns the single `h1`, so page titles are `h2`; the
 * title also names the browser tab.
 */
export function PlaceholderPage({
  title,
  description,
  children,
}: PlaceholderPageProps) {
  useDocumentTitle(title);
  return (
    <section className="space-y-3">
      <h2 className="text-2xl">{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  );
}
