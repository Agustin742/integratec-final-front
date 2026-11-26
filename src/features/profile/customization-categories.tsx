import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { profileMessages } from './messages';

const copy = profileMessages.avatar;

export type CategoryId = keyof typeof copy.categories;

/** Line icons in the same stroke style as the rest of the panel. */
const ICON_PATHS: Readonly<Record<CategoryId, string>> = {
  body: 'M8 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3.5 14v-2.5A3.5 3.5 0 0 1 7 8h2a3.5 3.5 0 0 1 3.5 3.5V14',
  hair: 'M3 9a5 5 0 0 1 10 0v4h-2.5V8.5C9 8.5 7 7.5 6 6c-.2 1.4-.8 2.2-1.5 2.5V13H3Z',
  clothing:
    'M5.5 2 2 4.5 3.5 7l1.5-.8V14h6V6.2l1.5.8L14 4.5 10.5 2a2.5 2.5 0 0 1-5 0Z',
  accessories:
    'M1.5 8h1M13.5 8h1M7 8.5c.5-.7 1.5-.7 2 0M4.8 11a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Zm6.4 0a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z',
};

export function CategoryIcon({ category }: { readonly category: CategoryId }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[category]} />
    </svg>
  );
}

/**
 * Jumps to a category and moves focus to its heading. Buttons, not hash links:
 * a location change would trip the unsaved-draft blocker.
 */
export function CategoryNav({
  headingIds,
}: {
  readonly headingIds: Readonly<Record<CategoryId, string>>;
}) {
  const goTo = (category: CategoryId) => {
    const heading = document.getElementById(headingIds[category]);
    heading?.scrollIntoView?.({ block: 'start' });
    heading?.focus({ preventScroll: true });
  };

  return (
    <nav aria-label={copy.categoriesLabel}>
      <ul className="flex flex-wrap gap-2">
        {(Object.keys(copy.categories) as CategoryId[]).map((category) => (
          <li key={category}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 gap-2"
              onClick={() => goTo(category)}
            >
              <CategoryIcon category={category} />
              {copy.categories[category]}
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** One group of related choices under a focusable heading. */
export function CategorySection({
  category,
  headingId,
  children,
}: {
  readonly category: CategoryId;
  readonly headingId: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-3 border-t border-edge pt-4"
    >
      <h4
        id={headingId}
        tabIndex={-1}
        className="flex items-center gap-2 font-display text-base font-semibold text-foreground"
      >
        <CategoryIcon category={category} />
        {copy.categories[category]}
      </h4>
      {children}
    </section>
  );
}
