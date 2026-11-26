import { useId } from 'react';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/feedback/states';
import type { AvatarBodyId } from '@/features/world/avatar/accessory-catalog';
import { inventoryMessages } from './inventory-messages';
import { InventoryPanel } from './inventory-panel';
import type { StudentClassrooms } from './use-student-classrooms';

const msgs = inventoryMessages.profile;

export interface ProfileInventorySectionProps {
  readonly classrooms: StudentClassrooms;
  /** Body the item pictures are drawn on. */
  readonly bodyId: AvatarBodyId;
  /** Whether the section is on screen; pictures are only drawn then. */
  readonly active: boolean;
}

/**
 * Accessories part of the profile customization: students pick one of their
 * enrolled student classrooms and manage avatar/desk equipment from
 * `/profile`.
 */
export function ProfileInventorySection({
  classrooms,
  bodyId,
  active,
}: ProfileInventorySectionProps) {
  const headingId = useId();
  const selectId = useId();
  const { query, items, activeId, select } = classrooms;
  const activeName = items.find(({ id }) => id === activeId)?.name;

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h4
        id={headingId}
        className="font-display text-base font-semibold text-foreground"
      >
        {msgs.heading}
      </h4>

      {query.isPending && query.data === undefined ? (
        <LoadingState label={msgs.loading} skeletonLines={2} />
      ) : query.isError && query.data === undefined ? (
        <ErrorState
          headingLevel="h4"
          title={msgs.errorTitle}
          description={msgs.errorDescription}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          headingLevel="h4"
          title={msgs.emptyTitle}
          description={msgs.emptyDescription}
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-2 rounded-2xl bg-tray/60 p-3">
            {items.length > 1 && (
              <div className="flex flex-col gap-1 sm:max-w-xs">
                <label
                  htmlFor={selectId}
                  className="text-sm font-semibold text-foreground"
                >
                  {msgs.classroomLabel}
                </label>
                <select
                  id={selectId}
                  value={activeId}
                  onChange={(event) => select(event.target.value)}
                  className="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                >
                  {items.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {activeName !== undefined && (
              <p className="text-sm text-foreground">
                {msgs.classroomNote(activeName)}
              </p>
            )}
          </div>

          {activeId ? (
            <InventoryPanel
              classroomId={activeId}
              pictures={{
                bodyId,
                active,
                shopHref: `/classrooms/${activeId}/panels/shop`,
              }}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
