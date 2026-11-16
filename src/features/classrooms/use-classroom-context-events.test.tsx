import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { createSession } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import {
  harness,
  json,
  profile,
  rotated,
  saved,
  tokens,
} from '@/session/test-fixtures';
import { render } from '@/test/render';
import {
  useClassroomContext,
  useClassroomCapabilities,
} from './use-classroom-capabilities';
import { useClassroomContextEvents } from './use-classroom-context-events';

function Owner({ id }: { id: string }) {
  useClassroomContextEvents(id);
  const context = useClassroomContext(id);
  return (
    <>
      <output aria-label="context">
        {context.status === 'ready' ? context.classroom.name : context.status}
      </output>
      <Guard id={id} />
    </>
  );
}
function Guard({ id }: { id: string }) {
  const capabilities = useClassroomCapabilities(id);
  return (
    <output aria-label="guard">
      {capabilities.status === 'ready' &&
      capabilities.can('configure_classroom')
        ? 'private'
        : 'denied'}
    </output>
  );
}
function setup(streamStatus: (request: Request) => number = () => 200) {
  const streams: {
    request: Request;
    source: ReadableStreamDefaultController<Uint8Array>;
    cancel: ReturnType<typeof vi.fn>;
  }[] = [];
  let hold = false;
  const pending: { request: Request; resolve: (response: Response) => void }[] =
    [];
  const detail = (name = 'Confirmed') =>
    json({
      id: 'a',
      name,
      myRole: 'TEACHER',
      capabilities: ['configure_classroom'],
      availablePanels: ['grades'],
    });
  const h = harness((request) => {
    if (request.url.endsWith('/users/me')) return json(profile);
    if (request.url.endsWith('/auth/refresh')) return json(rotated);
    if (request.url.endsWith('/auth/logout'))
      return new Response(null, { status: 204 });
    if (request.url.endsWith('/context-events')) {
      const status = streamStatus(request);
      if (status !== 200) return json({}, status);
      const cancel = vi.fn();
      return new Response(
        new ReadableStream<Uint8Array>({
          start(source) {
            streams.push({ request, source, cancel });
          },
          cancel,
        }),
        { headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
      );
    }
    return hold
      ? new Promise<Response>((resolve) => {
          pending.push({ request, resolve });
        })
      : detail();
  }, saved());
  const service = createSession(h);
  const client = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const tree = (id: string) => (
    <ApiQueryProvider client={client}>
      <SessionProvider service={service}>
        <Owner id={id} />
      </SessionProvider>
    </ApiQueryProvider>
  );
  const view = render(tree('a'));
  return {
    ...view,
    h,
    service,
    streams,
    pending,
    detail,
    switchTo: (id: string) => view.rerender(tree(id)),
    hold: () => {
      hold = true;
    },
    hint: async (count = 1) =>
      act(async () => {
        for (let i = 0; i < count; i++)
          streams
            .at(-1)!
            .source.enqueue(
              new TextEncoder().encode(
                'event: classroom.context-invalidated\ndata: {"classroomId":"a"}\n\n',
              ),
            );
      }),
  };
}
async function ready() {
  await act(async () => {
    await vi.waitFor(() =>
      expect(screen.getByLabelText('context')).toHaveTextContent('Confirmed'),
    );
  });
  expect(screen.getByLabelText('guard')).toHaveTextContent('private');
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test('initial and duplicate hints fence every public consumer; obsolete REST cannot regrant', async () => {
  const view = setup();
  await ready();
  expect(view.streams).toHaveLength(1); // Capability consumer must not subscribe.
  view.hold();
  await view.hint(); // Initial registration hint is not special/replayable.
  await waitFor(() =>
    expect(screen.getByLabelText('guard')).toHaveTextContent('denied'),
  );
  expect(screen.getByLabelText('context')).toHaveTextContent('pending');
  await view.hint(2);
  expect(view.pending.length).toBeGreaterThanOrEqual(2);
  expect(view.pending[0].request.signal.aborted).toBe(true);
  await act(async () => {
    view.pending[0].resolve(view.detail('Obsolete'));
  });
  expect(screen.getByLabelText('guard')).toHaveTextContent('denied');
  await act(async () => {
    view.pending.at(-1)!.resolve(view.detail());
  });
  await ready();
  expect(view.streams).toHaveLength(1);
});

test('EOF reloads REST, reconnects with bounded delay and unmount cancels reader/timers', async () => {
  vi.useFakeTimers();
  const view = setup();
  await ready();
  const before = view.h.requests.length;
  await act(async () => {
    view.streams[0].source.close();
  });
  expect(view.h.requests.length).toBeGreaterThan(before);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(999);
  });
  expect(view.streams).toHaveLength(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(view.streams).toHaveLength(2);
  view.unmount();
  expect(view.streams[1].request.signal.aborted).toBe(true);
  expect(view.streams[1].cancel).toHaveBeenCalledOnce();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120_000);
  });
  expect(view.streams).toHaveLength(2);
});

test('classroom switch and actual session logout abort readers and cannot restore private context', async () => {
  const view = setup();
  await ready();
  view.switchTo('b');
  await waitFor(() => expect(view.streams).toHaveLength(2));
  expect(view.streams[0].request.signal.aborted).toBe(true);
  expect(view.streams[0].cancel).toHaveBeenCalledOnce();
  await act(() => view.service.controller.logout());
  expect(view.streams[1].request.signal.aborted).toBe(true);
  expect(screen.getByLabelText('guard')).toHaveTextContent('denied');
  expect(screen.getByLabelText('context')).toHaveTextContent('pending');
});

test('stream 401 uses existing one-refresh GET replay and subsequent renewal uses latest Bearer', async () => {
  vi.useFakeTimers();
  const view = setup((request) =>
    request.headers.get('Authorization') === `Bearer ${tokens.accessToken}`
      ? 401
      : 200,
  );
  await ready();
  expect(view.streams).toHaveLength(1);
  expect(
    view.h.requests.filter((r) => r.url.endsWith('/auth/refresh')),
  ).toHaveLength(1);
  expect(view.streams[0].request.headers.get('Authorization')).toBe(
    `Bearer ${rotated.accessToken}`,
  );
  expect(view.streams[0].request.url).not.toContain('access');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(view.streams[0].request.signal.aborted).toBe(true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
  });
  expect(view.streams).toHaveLength(2);
  expect(view.streams[1].request.headers.get('Authorization')).toBe(
    `Bearer ${rotated.accessToken}`,
  );
});

test('remaining stream 401 releases the real session rather than starting a retry loop', async () => {
  const view = setup(() => 401);
  await waitFor(() =>
    expect(view.service.controller.getSnapshot().status).toBe(
      'unauthenticated',
    ),
  );
  expect(
    view.h.requests.filter((r) => r.url.endsWith('/auth/refresh')),
  ).toHaveLength(1);
  expect(
    view.h.requests.filter((r) => r.url.endsWith('/context-events')),
  ).toHaveLength(2);
  expect(screen.getByLabelText('guard')).toHaveTextContent('denied');
});

test.each([404, 503])(
  'stream setup %i has terminal inaccessible vs bounded retry semantics',
  async (status) => {
    vi.useFakeTimers();
    let retryAt = 0;
    const timeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(
      (...args: Parameters<typeof setTimeout>) => {
        const delay = args[1];
        if (delay === 1_000) retryAt = Date.now() + delay;
        return timeout(...args);
      },
    );
    const view = setup(() => status);
    await ready();
    const attempts = () =>
      view.h.requests.filter((r) => r.url.endsWith('/context-events')).length;
    expect(attempts()).toBe(1);
    const untilRetry = status === 503 ? retryAt - Date.now() : 1_000;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(untilRetry - 1);
    });
    expect(attempts()).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(attempts()).toBe(status === 503 ? 2 : 1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_999);
    });
    expect(attempts()).toBe(status === 503 ? 2 : 1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(attempts()).toBe(status === 503 ? 3 : 1);
  },
);
