import { useEffect } from 'react';
import { messages } from '../messages';

/** `<page> · <app>`: the page comes first so tabs and history stay readable. */
export function formatDocumentTitle(page: string): string {
  return `${page} · ${messages.title}`;
}

/**
 * The single place that writes `document.title`. Every view that can occupy
 * the page area calls it with its own heading text: pages through
 * `PlaceholderPage`, and the error views directly. Deriving the title from the
 * view itself (not from the matched route) keeps a 403/404/error view from
 * inheriting the title of the route that failed.
 */
export function useDocumentTitle(page: string | undefined): void {
  useEffect(() => {
    if (page !== undefined) document.title = formatDocumentTitle(page);
  }, [page]);
}
