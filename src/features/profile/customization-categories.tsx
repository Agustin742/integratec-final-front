import { TabsList, TabsTrigger } from '@/components/ui/tabs';
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

/** The category tabs: arrow keys move between them (Radix). */
export function CategoryTabs() {
  return (
    <TabsList aria-label={copy.categoriesLabel} className="flex w-full">
      {(Object.keys(copy.categories) as CategoryId[]).map((category) => (
        <TabsTrigger
          key={category}
          value={category}
          className="min-h-11 flex-auto gap-2 px-2 text-sm sm:text-base"
        >
          <span className="hidden sm:block">
            <CategoryIcon category={category} />
          </span>
          {copy.categories[category]}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
