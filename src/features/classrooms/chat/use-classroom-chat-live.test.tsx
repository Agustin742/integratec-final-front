import type { InfiniteData } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { classroomChatHistoryQueryKey } from '@/api/query-keys';
import { fakeSession } from '@/app/router/fake-session';
import { ClassroomRealtimeProvider } from '@/realtime/classroom-realtime-provider';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { createFakeRealtimeSdk } from '@/test/realtime/fake-realtime-sdk';
import type {
  ChatHistoryMessageDto,
  PaginatedChatHistoryDto,
} from './chat-schema';
import { useClassroomChatLive } from './use-classroom-chat-live';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000051';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000007002';
const PAGE_SIZE = 20;

type HistoryData = InfiniteData<PaginatedChatHistoryDto, number>;

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function historyMessage(
  n: number,
  overrides: Partial<ChatHistoryMessageDto> = {},
): ChatHistoryMessageDto {
  return {
    id: uuid(n),
    classroomId: CLASSROOM_ID,
    authorId: OTHER_USER_ID,
    body: `Mensaje ${n}`,
    mentionedUserIds: [],
    createdAt: new Date(
      Date.parse('2026-11-19T03:00:00.000Z') + n * 60_000,
    ).toISOString(),
    hiddenAt: null,
    hiddenById: null,
    ...overrides,
  };
}

function livePayload(n: number) {
  const {
    hiddenAt: _hiddenAt,
    hiddenById: _hiddenById,
    ...payload
  } = historyMessage(n);
  void _hiddenAt;
  void _hiddenById;
  return payload;
}

function setup(options: { canModerate?: boolean; seed?: number[] } = {}) {
  const sdk = createFakeRealtimeSdk();
  const session = fakeSession({ status: 'authenticated', user: profile });
  session.service.controller.getAccessToken = () => 'live-token';
  session.service.controller.refreshAccessToken = async () => 'live-token';
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const key = classroomChatHistoryQueryKey(profile.id, CLASSROOM_ID, {
    pageSize: PAGE_SIZE,
  });
  const seed = options.seed ?? [2, 1];
  queryClient.setQueryData<HistoryData>(key, {
    pages: [
      {
        items: seed.map((n) => historyMessage(n)),
        page: 1,
        pageSize: PAGE_SIZE,
        total: seed.length,
      },
    ],
    pageParams: [1],
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <ApiQueryProvider client={queryClient}>
        <SessionProvider service={session.service}>
          <ClassroomRealtimeProvider
            realtimeUrl="wss://realtime.example.invalid"
            createSdkClient={sdk.createSdkClient}
            releaseGraceMs={0}
          >
            {children}
          </ClassroomRealtimeProvider>
        </SessionProvider>
      </ApiQueryProvider>
    </StrictMode>
  );
  const view = renderHook(
    () =>
      useClassroomChatLive(CLASSROOM_ID, {
        canModerate: options.canModerate ?? false,
      }),
    { wrapper },
  );

  const history = () => queryClient.getQueryData<HistoryData>(key);
  const ids = () =>
    history()?.pages.flatMap((page) => page.items.map((m) => m.id));
  const room = async () => {
    await waitFor(() => expect(sdk.roomFor(CLASSROOM_ID)).toBeDefined());
    await waitFor(() => expect(sdk.roomFor(CLASSROOM_ID)?.leave).toBeDefined());
    return sdk.roomFor(CLASSROOM_ID)!;
  };
  return { ...view, sdk, queryClient, invalidate, history, ids, room };
}

describe('useClassroomChatLive', () => {
  it('joins the classroom room once and puts a received message at the top of the cached history', async () => {
    const t = setup();
    const room = await t.room();

    act(() => room.emitMessage('chat:message', livePayload(3)));

    expect(t.ids()).toEqual([uuid(3), uuid(2), uuid(1)]);
    expect(t.history()?.pages[0].total).toBe(3);
    expect(t.history()?.pages[0].items[0]).toMatchObject({
      body: 'Mensaje 3',
      hiddenAt: null,
      hiddenById: null,
    });
    expect(t.sdk.joinedClassrooms).toEqual([CLASSROOM_ID]);
  });

  it('shows a duplicated event (same id) once', async () => {
    const t = setup();
    const room = await t.room();

    act(() => {
      room.emitMessage('chat:message', livePayload(3));
      room.emitMessage('chat:message', livePayload(3));
    });

    expect(t.ids()).toEqual([uuid(3), uuid(2), uuid(1)]);
    expect(t.history()?.pages[0].total).toBe(3);
  });

  it('does not duplicate a message already confirmed by the REST history', async () => {
    const t = setup();
    const room = await t.room();

    act(() => room.emitMessage('chat:message', livePayload(2)));

    expect(t.ids()).toEqual([uuid(2), uuid(1)]);
    expect(t.history()?.pages[0].total).toBe(2);
  });

  it('ignores an invalid payload', async () => {
    const t = setup();
    const room = await t.room();

    act(() => {
      room.emitMessage('chat:message', { ...livePayload(3), body: '' });
      room.emitMessage('chat:message', { ...livePayload(4), extra: 'nope' });
      room.emitMessage('chat:message', 'not an object');
    });

    expect(t.ids()).toEqual([uuid(2), uuid(1)]);
  });

  it('ignores a message of another classroom', async () => {
    const t = setup();
    const room = await t.room();

    act(() =>
      room.emitMessage('chat:message', {
        ...livePayload(3),
        classroomId: uuid(999),
      }),
    );

    expect(t.ids()).toEqual([uuid(2), uuid(1)]);
  });

  it('removes a hidden message from a student history', async () => {
    const t = setup({ canModerate: false });
    const room = await t.room();

    act(() =>
      room.emitMessage('chat:message.hidden', {
        messageId: uuid(1),
        hiddenAt: '2026-11-19T04:00:00.000Z',
      }),
    );

    expect(t.ids()).toEqual([uuid(2)]);
    expect(t.history()?.pages[0].total).toBe(1);
    expect(t.invalidate).not.toHaveBeenCalled();
  });

  it('refetches the history for staff instead of removing the hidden message', async () => {
    const t = setup({ canModerate: true });
    const room = await t.room();

    act(() =>
      room.emitMessage('chat:message.hidden', {
        messageId: uuid(1),
        hiddenAt: '2026-11-19T04:00:00.000Z',
      }),
    );

    expect(t.ids()).toEqual([uuid(2), uuid(1)]);
    expect(t.invalidate).toHaveBeenCalledTimes(1);
  });

  it('revalidates the history after the connection is lost and recovered', async () => {
    const t = setup();
    const first = await t.room();
    await waitFor(() => expect(t.sdk.roomFor(CLASSROOM_ID)).toBe(first));
    expect(t.invalidate).not.toHaveBeenCalled();

    act(() => first.emitDrop());

    await waitFor(() => expect(t.sdk.rooms.length).toBeGreaterThan(1));
    await waitFor(() => expect(t.invalidate).toHaveBeenCalledTimes(1));
  });

  it('stops listening and leaves the room on unmount', async () => {
    const t = setup();
    const room = await t.room();

    t.unmount();

    await waitFor(() => expect(room.leave).toHaveBeenCalled());
  });
});
