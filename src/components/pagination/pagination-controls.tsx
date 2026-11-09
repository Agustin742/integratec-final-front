import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getPaginationMeta } from './pagination';

export const paginationMessages = {
  navigationLabel: 'Paginación',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  emptySummary: 'Sin resultados',
  formatRange: (start: number, end: number, total: number): string =>
    `Mostrando ${start}–${end} de ${total}`,
  formatPageIndicator: (page: number, totalPages: number): string =>
    `Página ${page} de ${totalPages}`,
} as const;

export type PaginationControlsProps = Omit<
  ComponentProps<'nav'>,
  'children'
> & {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (nextPage: number) => void;
  busy?: boolean;
  disabled?: boolean;
  label?: string;
};

/**
 * Accessible pagination controls matching the backend `Paginated<T>` contract
 * (`rules/ui-and-accessibility.md`, `rules/api-contracts.md`).
 */
export function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  busy = false,
  disabled = false,
  label = paginationMessages.navigationLabel,
  className,
  ...props
}: PaginationControlsProps) {
  const meta = getPaginationMeta({ page, pageSize, total });
  const prevDisabled = disabled || busy || !meta.hasPreviousPage;
  const nextDisabled = disabled || busy || !meta.hasNextPage;

  return (
    <nav
      {...props}
      aria-label={label}
      className={cn(
        'flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge bg-card px-4 py-3 text-sm text-card-foreground shadow-panel',
        className,
      )}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex flex-wrap items-center gap-2 text-muted-foreground"
      >
        <span>
          {meta.total === 0
            ? paginationMessages.emptySummary
            : paginationMessages.formatRange(
                meta.rangeStart,
                meta.rangeEnd,
                meta.total,
              )}
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-display font-semibold text-foreground">
          {paginationMessages.formatPageIndicator(meta.page, meta.totalPages)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={prevDisabled}
          onClick={() => {
            if (!prevDisabled) {
              onPageChange(meta.page - 1);
            }
          }}
        >
          {paginationMessages.previousPage}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={nextDisabled}
          onClick={() => {
            if (!nextDisabled) {
              onPageChange(meta.page + 1);
            }
          }}
        >
          {paginationMessages.nextPage}
        </Button>
      </div>
    </nav>
  );
}
