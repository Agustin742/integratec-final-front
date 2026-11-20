import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { ApiError } from '@/api/errors';
import { chatInboxQueryKey } from '@/api/query-keys';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import type { ChatInboxDto } from './chat-inbox-schema';
import { markChatRead } from './chat-inbox-service';
import {
  READ_MARKER_DEBOUNCE_MS,
  useChatReadMarker,
} from './use-chat-read-marker';

vi.mock('./chat-inbox-service', () => ({
  markChatRead: vi.fn(),
  listChatInbox: vi.fn(),
}));

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000051';
const M1 = '00000000-0000-4000-8000-600000000001';
const M2 = '00000000-0000-4000-8000-600000000002';

const inbox = (unreadCount: number, lastId: string): ChatInboxDto => ({
  items: [
    {
      classroomId: CLASSROOM_ID,
      classroomName: 'Matemática',
      lastMessage: {
        id: lastId,
        authorId: 'someone',
        authorDisplayName: 'Sofía',
        bodyPreview: 'Hola',
        createdAt: '2026-11-19T03:00:00.000Z',
      },
      unreadCount,
    },
  ],
});

function setup(initial: { newest: string | null; inView: boolean }) {
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session = fakeSession({ status: 'authenticated', user: profile });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <ApiQueryProvider client={queryClient}>
        <SessionProvider service={session.service}>{children}</SessionProvider>
      </ApiQueryProvider>
    );
  }
  const view = renderHook(
    (props: { newest: string | null; inView: boolean }) => {
      useChatReadMarker({
        userId: profile.id,
        classroomId: CLASSROOM_ID,
        newestMessageId: props.newest,
        inView: props.inView,
      });
    },
    { wrapper: Wrapper, initialProps: initial },
  );
  return { ...view, queryClient, invalidate };
}

async function elapse(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useChatReadMarker', () => {
  const mark = vi.mocked(markChatRead);

  beforeEach(() => {
    vi.useFakeTimers();
    mark.mockReset();
    mark.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('reports the newest message once, after the debounce', async () => {
    setup({ newest: M1, inView: true });

    await elapse(READ_MARKER_DEBOUNCE_MS - 1);
    expect(mark).not.toHaveBeenCalled();
    await elapse(1);

    expect(mark).toHaveBeenCalledTimes(1);
    expect(mark).toHaveBeenCalledWith(expect.anything(), CLASSROOM_ID, M1);
    await elapse(5000);
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('waits until the newest message is in view', async () => {
    const view = setup({ newest: M1, inView: false });
    await elapse(3000);
    expect(mark).not.toHaveBeenCalled();

    view.rerender({ newest: M1, inView: true });
    await elapse(READ_MARKER_DEBOUNCE_MS);
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('sends only when the newest message advances and debounces bursts', async () => {
    const view = setup({ newest: M1, inView: true });
    await elapse(READ_MARKER_DEBOUNCE_MS);
    expect(mark).toHaveBeenCalledTimes(1);

    view.rerender({ newest: M1, inView: true });
    await elapse(3000);
    expect(mark).toHaveBeenCalledTimes(1);

    view.rerender({ newest: 'burst-1', inView: true });
    await elapse(400);
    view.rerender({ newest: M2, inView: true });
    await elapse(READ_MARKER_DEBOUNCE_MS);
    expect(mark).toHaveBeenCalledTimes(2);
    expect(mark).toHaveBeenLastCalledWith(expect.anything(), CLASSROOM_ID, M2);
  });

  it('does nothing without messages or while the page is hidden', async () => {
    const empty = setup({ newest: null, inView: true });
    await elapse(3000);
    expect(mark).not.toHaveBeenCalled();
    empty.unmount();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    setup({ newest: M1, inView: true });
    await elapse(3000);
    expect(mark).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await elapse(READ_MARKER_DEBOUNCE_MS);
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('skips the request when the inbox already shows that message as read', async () => {
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(chatInboxQueryKey(profile.id), inbox(0, M1));
    const session = fakeSession({ status: 'authenticated', user: profile });
    renderHook(
      () => {
        useChatReadMarker({
          userId: profile.id,
          classroomId: CLASSROOM_ID,
          newestMessageId: M1,
          inView: true,
        });
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ApiQueryProvider client={queryClient}>
            <SessionProvider service={session.service}>
              {children}
            </SessionProvider>
          </ApiQueryProvider>
        ),
      },
    );
    await elapse(3000);
    expect(mark).not.toHaveBeenCalled();
  });

  it('clears the cached unread count and revalidates the inbox when accepted', async () => {
    const view = setup({ newest: M1, inView: true });
    view.queryClient.setQueryData(chatInboxQueryKey(profile.id), inbox(3, M1));

    await elapse(READ_MARKER_DEBOUNCE_MS);

    expect(
      view.queryClient.getQueryData<ChatInboxDto>(chatInboxQueryKey(profile.id))
        ?.items[0].unreadCount,
    ).toBe(0);
    expect(view.invalidate).toHaveBeenCalledWith({
      queryKey: chatInboxQueryKey(profile.id),
      exact: true,
    });
  });

  it.each([403, 404])('ignores a %i without retrying', async (status) => {
    mark.mockRejectedValue(
      new ApiError({
        kind: status === 404 ? 'not-found' : 'forbidden',
        status,
        code: null,
        userMessage: 'x',
        details: [],
        fieldErrors: {},
        correlationId: null,
      }),
    );
    const view = setup({ newest: M1, inView: true });
    view.queryClient.setQueryData(chatInboxQueryKey(profile.id), inbox(3, M1));

    await elapse(READ_MARKER_DEBOUNCE_MS);
    await elapse(5000);

    expect(mark).toHaveBeenCalledTimes(1);
    expect(
      view.queryClient.getQueryData<ChatInboxDto>(chatInboxQueryKey(profile.id))
        ?.items[0].unreadCount,
    ).toBe(3);
  });

  it('retries on the next advance after a transient failure', async () => {
    mark.mockRejectedValueOnce(new Error('offline'));
    const view = setup({ newest: M1, inView: true });
    await elapse(READ_MARKER_DEBOUNCE_MS);
    expect(mark).toHaveBeenCalledTimes(1);

    view.rerender({ newest: M2, inView: true });
    await elapse(READ_MARKER_DEBOUNCE_MS);
    expect(mark).toHaveBeenCalledTimes(2);
  });
});
