import { describe, expect, it } from 'vitest';
import {
  chatInboxQueryKey,
  classroomChatHistoryQueryKey,
  createClassroomChatPredicate,
} from './query-keys';

describe('chat inbox query key', () => {
  it('is scoped by user in its own domain', () => {
    const a = chatInboxQueryKey('user-a');
    const b = chatInboxQueryKey('user-b');
    expect(a).not.toEqual(b);
    expect(a[0].domain).toBe('chat-inbox');
    expect(a[0].scope.userId).toBe('user-a');
    expect(a[0].scope.classroomId).toBeNull();
  });

  it('is never swept by the classroom chat predicate', () => {
    const predicate = createClassroomChatPredicate('user-a', 'room-1');
    expect(predicate({ queryKey: chatInboxQueryKey('user-a') })).toBe(false);
    expect(
      predicate({
        queryKey: classroomChatHistoryQueryKey('user-a', 'room-1'),
      }),
    ).toBe(true);
  });

  it('rejects a blank user', () => {
    expect(() => chatInboxQueryKey(' ')).toThrow();
  });
});
