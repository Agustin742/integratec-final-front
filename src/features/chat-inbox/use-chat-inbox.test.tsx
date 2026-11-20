import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { chatInboxQueryKey } from '@/api/query-keys';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { createChatInboxStore, TEST_API_BASE_URL } from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import type { ChatInboxDto } from './chat-inbox-schema';
import {
  CHAT_INBOX_POLL_INTERVAL_MS,
  clearInboxUnread,
  useChatInbox,
} from './use-chat-inbox';

const CLASSROOM_A = '00000000-0000-4000-8000-000000000051';
const CLASSROOM_B = '00000000-0000-4000-8000-000000000052';
const OTHER_ID = '00000000-0000-4000-8000-000000007002';

function message(id: string, minute: number) {
  return {
    id,
    authorId: OTHER_ID,
    authorDisplayName: 'Sofía Martínez',
    body: 'Hola',
    createdAt: new Date(
      Date.parse('2026-11-19T03:00:00.000Z') + minute * 60_000,
    ).toISOString(),
  };
}

function setup(authenticated = true) {
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session = fakeSession(
    authenticated
      ? { status: 'authenticated', user: profile }
      : { status: 'unauthenticated' },
    createApiClient({ baseUrl: TEST_API_BASE_URL }),
  );
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <ApiQueryProvider client={queryClient}>
        <SessionProvider service={session.service}>{children}</SessionProvider>
      </ApiQueryProvider>
    );
  }
  return { queryClient, Wrapper };
}

describe('useChatInbox', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('loads the inbox, totals the unread counts and polls', async () => {
    const store = createChatInboxStore({
      currentUserId: profile.id,
      classrooms: [
        {
          classroomId: CLASSROOM_A,
          classroomName: 'Matemática',
          messages: [message('m1', 1), message('m2', 2)],
        },
        {
          classroomId: CLASSROOM_B,
          classroomName: 'Lengua',
          messages: [message('m3', 3)],
        },
      ],
    });
    mswServer.use(...store.handlers);
    const { queryClient, Wrapper } = setup();

    const { result } = renderHook(() => useChatInbox(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.totalUnread).toBe(3);
    });
    expect(result.current.inbox?.items).toHaveLength(2);
    const query = queryClient
      .getQueryCache()
      .find({ queryKey: chatInboxQueryKey(profile.id) });
    expect(query?.observers[0]?.options.refetchInterval).toBe(
      CHAT_INBOX_POLL_INTERVAL_MS,
    );
    expect(query?.observers[0]?.options.refetchOnWindowFocus).toBe(true);
  });

  it('does not request anything while signed out', async () => {
    const store = createChatInboxStore({
      currentUserId: profile.id,
      classrooms: [],
    });
    mswServer.use(...store.handlers);
    const { Wrapper } = setup(false);

    const { result } = renderHook(() => useChatInbox(), { wrapper: Wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.totalUnread).toBe(0);
    expect(store.getCounts().list).toBe(0);
  });

  it('clears one classroom unread count in the cache', () => {
    const { queryClient } = setup();
    const key = chatInboxQueryKey(profile.id);
    const inbox: ChatInboxDto = {
      items: [
        {
          classroomId: CLASSROOM_A,
          classroomName: 'Matemática',
          lastMessage: null,
          unreadCount: 2,
        },
        {
          classroomId: CLASSROOM_B,
          classroomName: 'Lengua',
          lastMessage: null,
          unreadCount: 1,
        },
      ],
    };
    queryClient.setQueryData(key, inbox);

    clearInboxUnread(queryClient, profile.id, CLASSROOM_A);

    expect(
      queryClient
        .getQueryData<ChatInboxDto>(key)
        ?.items.map((i) => i.unreadCount),
    ).toEqual([0, 1]);
    // Not loaded yet: nothing is created out of thin air.
    clearInboxUnread(queryClient, 'someone-else', CLASSROOM_A);
    expect(
      queryClient.getQueryData(chatInboxQueryKey('someone-else')),
    ).toBeUndefined();
  });
});
