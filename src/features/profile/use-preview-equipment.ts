import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { classroomEquipmentQueryKey } from '@/api/query-keys';
import type { AvatarEquipped } from '@/features/world/avatar/avatar-part-plan';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { getEquipment } from '../inventory/inventory-service';

const AVATAR_SLOTS = ['head', 'face', 'back', 'hand', 'neck', 'ears'] as const;

/**
 * Accessories worn in one classroom, for the profile preview. It reads the
 * same cache entry as the inventory, so equipping shows at once. A failed
 * read only leaves the preview without accessories.
 */
export function usePreviewEquipment(
  classroomId: string,
): AvatarEquipped | undefined {
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const query = useQuery({
    queryKey: classroomEquipmentQueryKey(
      userId ?? 'anonymous',
      classroomId || 'unknown',
    ),
    queryFn: ({ signal }) => getEquipment(client, classroomId, { signal }),
    enabled: userId !== null && classroomId !== '',
    retry: false,
  });

  const slots = query.data?.slots;
  return useMemo(
    () =>
      classroomId !== '' && slots
        ? Object.fromEntries(
            AVATAR_SLOTS.map((slot) => [
              slot,
              slots[slot]?.shopItemCode ?? null,
            ]),
          )
        : undefined,
    [classroomId, slots],
  );
}
