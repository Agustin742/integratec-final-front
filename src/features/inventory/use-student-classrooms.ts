import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { classroomListQueryKey } from '@/api/query-keys';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { listAccessibleClassrooms } from '../classrooms/classroom-service';

const PARAMS = { page: 1, pageSize: 50, sort: '-createdAt' } as const;

/**
 * The user's student classrooms and the one chosen for accessories. Owned by
 * the profile so the preview stays dressed whatever tab is open.
 */
export function useStudentClassrooms() {
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const [selectedId, select] = useState('');

  const query = useQuery({
    queryKey: classroomListQueryKey(userId ?? 'anonymous', PARAMS),
    queryFn: ({ signal }) =>
      listAccessibleClassrooms(client, PARAMS, { signal }),
    enabled: Boolean(userId),
    retry: false,
  });

  const items = (query.data?.items ?? []).filter(
    (classroom) => classroom.myRole === 'STUDENT',
  );
  const activeId = items.some((classroom) => classroom.id === selectedId)
    ? selectedId
    : (items[0]?.id ?? '');

  return { query, items, activeId, select };
}

export type StudentClassrooms = ReturnType<typeof useStudentClassrooms>;
