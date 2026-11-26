import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { classroomListQueryKey } from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/feedback/states';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { listAccessibleClassrooms } from '../classrooms/classroom-service';
import { inventoryMessages } from './inventory-messages';
import { InventoryPanel } from './inventory-panel';

const msgs = inventoryMessages.profile;

export interface ProfileInventorySectionProps {
  /** Id of the heading, so the customization categories can focus it. */
  readonly headingId?: string;
  /** Reports the classroom on screen, empty when there is none. */
  readonly onClassroomChange?: (classroomId: string) => void;
}

/**
 * Accessories part of the profile customization: students pick one of their
 * enrolled student classrooms and manage avatar/desk equipment from
 * `/profile`.
 */
export function ProfileInventorySection({
  headingId = 'profile-inventory-heading',
  onClassroomChange,
}: ProfileInventorySectionProps = {}) {
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const selectId = useId();
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');

  const classroomsQuery = useQuery({
    queryKey: classroomListQueryKey(userId ?? 'anonymous', {
      page: 1,
      pageSize: 50,
      sort: '-createdAt',
    }),
    queryFn: ({ signal }) =>
      listAccessibleClassrooms(
        client,
        { page: 1, pageSize: 50, sort: '-createdAt' },
        { signal },
      ),
    enabled: Boolean(userId),
    retry: false,
  });

  const studentClassrooms = (classroomsQuery.data?.items ?? []).filter(
    (classroom) => classroom.myRole === 'STUDENT',
  );

  const activeClassroomId = studentClassrooms.some(
    (c) => c.id === selectedClassroomId,
  )
    ? selectedClassroomId
    : (studentClassrooms[0]?.id ?? '');

  useEffect(() => {
    onClassroomChange?.(activeClassroomId);
  }, [activeClassroomId, onClassroomChange]);

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 border-t border-edge pt-4"
    >
      <div className="space-y-1">
        <h4
          id={headingId}
          tabIndex={-1}
          className="font-display text-base font-semibold text-foreground"
        >
          {msgs.heading}
        </h4>
        <p className="text-sm text-muted-foreground">{msgs.description}</p>
      </div>

      {classroomsQuery.isPending && classroomsQuery.data === undefined ? (
        <LoadingState label={msgs.loading} skeletonLines={2} />
      ) : classroomsQuery.isError && classroomsQuery.data === undefined ? (
        <ErrorState
          headingLevel="h4"
          title={msgs.errorTitle}
          description={msgs.errorDescription}
          onRetry={() => void classroomsQuery.refetch()}
          isRetrying={classroomsQuery.isFetching}
        />
      ) : studentClassrooms.length === 0 ? (
        <EmptyState
          headingLevel="h4"
          title={msgs.emptyTitle}
          description={msgs.emptyDescription}
        />
      ) : (
        <div className="space-y-4">
          {studentClassrooms.length > 1 ? (
            <div className="flex flex-col gap-1 sm:max-w-xs">
              <label
                htmlFor={selectId}
                className="text-xs font-medium text-muted-foreground"
              >
                {msgs.classroomLabel}
              </label>
              <select
                id={selectId}
                value={activeClassroomId}
                onChange={(event) => setSelectedClassroomId(event.target.value)}
                className="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {studentClassrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {activeClassroomId ? (
            <InventoryPanel classroomId={activeClassroomId} />
          ) : null}
        </div>
      )}
    </section>
  );
}
