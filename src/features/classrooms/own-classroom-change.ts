import type { QueryClient } from '@tanstack/react-query';

/**
 * The backend emits the same generic context hint for every classroom change,
 * including the one the signed-in staff member just made (e.g. renaming it from
 * Settings). A hint carries only `classroomId`, so it cannot be told apart from
 * a revocation. The context-events owner therefore resets the confirmed context
 * on a hint, which unmounts every open panel.
 *
 * To keep Settings usable, a save marks the classroom here before it sends the
 * PATCH. The next hint inside the window is treated as the echo of that own
 * write and is reconciled with a refetch instead of a reset. The refetch is
 * still authoritative: if access was actually revoked it fails and the
 * capability consumers stop exposing private content. Every other hint still
 * resets.
 */
const OWN_CHANGE_WINDOW_MS = 15_000;

const marks = new WeakMap<QueryClient, Map<string, number>>();

function markKey(userId: string, classroomId: string): string {
  return `${userId}:${classroomId}`;
}

export function markOwnClassroomChange(
  queryClient: QueryClient,
  userId: string,
  classroomId: string,
): void {
  const byScope = marks.get(queryClient) ?? new Map<string, number>();
  byScope.set(markKey(userId, classroomId), Date.now() + OWN_CHANGE_WINDOW_MS);
  marks.set(queryClient, byScope);
}

export function clearOwnClassroomChange(
  queryClient: QueryClient,
  userId: string,
  classroomId: string,
): void {
  marks.get(queryClient)?.delete(markKey(userId, classroomId));
}

export function clearAllOwnClassroomChanges(queryClient: QueryClient): void {
  marks.delete(queryClient);
}

/** True once per mark: the first hint inside the window consumes it. */
export function consumeOwnClassroomChange(
  queryClient: QueryClient,
  userId: string,
  classroomId: string,
): boolean {
  const byScope = marks.get(queryClient);
  const key = markKey(userId, classroomId);
  const expiresAt = byScope?.get(key);
  if (expiresAt === undefined) return false;
  byScope?.delete(key);
  return expiresAt >= Date.now();
}
