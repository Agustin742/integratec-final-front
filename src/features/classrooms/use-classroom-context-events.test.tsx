import { act, fireEvent, screen, waitFor } from '@testing-library/react';
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
  ClassroomPanelsProvider,
  useClassroomPanels,
} from './panels/classroom-panels';
import {
  useClassroomContext,
  useClassroomCapabilities,
} from './use-classroom-capabilities';
import { markOwnClassroomChange } from './own-classroom-change';
import {
  CONTEXT_RENEWAL_MS,
  useClassroomContextEvents,
} from './use-classroom-context-events';

function DraftPanel() {
  return <input aria-label="draft" defaultValue="" />;
}

function PanelOpener() {
  const panels = useClassroomPanels();
  return (
    <button type="button" onClick={() => panels.openPanel('grades')}>
      Open
    </button>
  );
}

function Owner({ id, enabled = true }: { id: string; enabled?: boolean }) {
  useClassroomContextEvents(id, enabled);
  const context = useClassroomContext(id, { enabled });
  return (
    <>
      <output aria-label="context">
        {context.status === 'ready' ? context.classroom.name : context.status}
      </output>
      <Guard id={id} />
      {context.status === 'ready' && (
        <ClassroomPanelsProvider
          userId={context.userId}
          classroomId={id}
          registry={[
            { key: 'grades', title: 'Grades Panel', component: DraftPanel },
          ]}
          availability={{
            confirmed: true,
            keys: context.classroom.availablePanels,
          }}
          description="Panel test"
          fallbackFocus={() => null}
        >
          <PanelOpener />
        </ClassroomPanelsProvider>
      )}
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
  const tree = (id: string, enabled = true) => (
    <ApiQueryProvider client={client}>
      <SessionProvider service={service}>
        <Owner id={id} enabled={enabled} />
      </SessionProvider>
    </ApiQueryProvider>
  );
  const view = render(tree('a'));
  return {
    ...view,
    h,
    service,
    client,
    streams,
    pending,
    detail,
    switchTo: (id: string, enabled = true) => view.rerender(tree(id, enabled)),
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

test('the registration hint is reconciled, later hints fence every public consumer; obsolete REST cannot regrant', async () => {
  const view = setup();
  await ready();
  expect(view.streams).toHaveLength(1); // Capability consumer must not subscribe.
  view.hold();
  await view.hint(); // Initial registration hint: covered by the post-connect reconcile.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(screen.getByLabelText('context')).toHaveTextContent('Confirmed');
  expect(screen.getByLabelText('guard')).toHaveTextContent('private');
  await view.hint(); // A later hint on the same connection is a real invalidation.
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
    await vi.advanceTimersByTimeAsync(CONTEXT_RENEWAL_MS);
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

test('open panel draft survives EOF and repeated renewals with 1s backoff reset; real hints still reset', async () => {
  vi.useFakeTimers();
  const view = setup();
  await ready();

  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  const draft = screen.getByLabelText('draft') as HTMLInputElement;
  fireEvent.change(draft, { target: { value: 'borrador docente' } });
  expect(draft).toHaveValue('borrador docente');

  // EOF reconciles via invalidation without unmounting the open panel.
  await act(async () => {
    view.streams[0].source.close();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
  });
  expect(view.streams).toHaveLength(2);
  expect(screen.getByLabelText('draft')).toHaveValue('borrador docente');

  // Six consecutive renewals keep the open dialog mounted and always reconnect in 1s.
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTEXT_RENEWAL_MS);
    });
    expect(screen.getByLabelText('draft')).toHaveValue('borrador docente');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(view.streams).toHaveLength(3 + i);
    expect(screen.getByLabelText('draft')).toHaveValue('borrador docente');
  }

  // The registration hint of the current connection does not reset...
  view.hold();
  await view.hint();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByLabelText('draft')).toHaveValue('borrador docente');
  // ...but an explicit invalidation hint still resets confirmed context immediately.
  await view.hint();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByLabelText('guard')).toHaveTextContent('denied');
  expect(screen.queryByLabelText('draft')).not.toBeInTheDocument();
});

test('backoff resets to 1s after recovering from transient 503 failures', async () => {
  vi.useFakeTimers();
  let streamAttempt = 0;
  const view = setup(() => (++streamAttempt <= 2 ? 503 : 200));
  await ready();
  expect(streamAttempt).toBe(1);

  // 1st retry after 1s -> 503, 2nd retry after 2s -> 200 healthy stream.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
  });
  expect(streamAttempt).toBe(2);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2_000);
  });
  expect(streamAttempt).toBe(3);
  expect(view.streams).toHaveLength(1);

  // Healthy stream resets backoff back to 1s on its renewal (not 4s).
  await act(async () => {
    await vi.advanceTimersByTimeAsync(CONTEXT_RENEWAL_MS);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
  });
  expect(view.streams).toHaveLength(2);
});

test('routine renewals never unmount the workspace: each connection first hint is only reconciled', async () => {
  vi.useFakeTimers();
  const view = setup();
  await ready();
  view.hold(); // A reset would leave the context pending; reconcile keeps data.
  for (let i = 0; i < 3; i++) {
    await view.hint(); // Server registration hint of the current connection.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByLabelText('context')).toHaveTextContent('Confirmed');
    expect(screen.getByLabelText('guard')).toHaveTextContent('private');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONTEXT_RENEWAL_MS);
    }); // Client renewal closes this connection.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(view.streams).toHaveLength(2 + i); // New connection, new first hint.
  }
});

test('a second hint on the same connection resets; a reconnect makes the next first hint harmless again', async () => {
  vi.useFakeTimers();
  const view = setup();
  await ready();
  view.hold();
  await view.hint(); // First hint: no reset.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByLabelText('guard')).toHaveTextContent('private');
  await act(async () => {
    view.streams[0].source.close();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
  });
  expect(view.streams).toHaveLength(2);
  await view.hint(); // First hint of the NEW connection: still no reset.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByLabelText('guard')).toHaveTextContent('private');
  await view.hint(); // Second hint of the same connection: reset.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByLabelText('guard')).toHaveTextContent('denied');
});

test('a hint echoing the user own classroom change refetches instead of resetting, so open panels survive; the next real hint still resets', async () => {
  vi.useFakeTimers();
  const view = setup();
  await ready();
  view.hold();
  await view.hint(); // Registration hint of this connection.
  markOwnClassroomChange(view.client, 'a'); // The settings save is about to echo.
  await view.hint(); // Echo of the own write.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByLabelText('context')).toHaveTextContent('Confirmed');
  expect(screen.getByLabelText('guard')).toHaveTextContent('private');
  expect(view.pending.length).toBeGreaterThan(0); // Still reconciled with the server.
  await view.hint(); // Anything else is a real invalidation again.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(screen.getByLabelText('guard')).toHaveTextContent('denied');
});

test('the client renews the stream before the backend 60s lifetime', async () => {
  expect(CONTEXT_RENEWAL_MS).toBeLessThan(60_000);
  vi.useFakeTimers();
  const timers = vi.spyOn(globalThis, 'setTimeout');
  const view = setup();
  await ready();
  const delays = timers.mock.calls.map((call) => call[1]);
  timers.mockRestore();
  expect(delays).toContain(CONTEXT_RENEWAL_MS);
  expect(view.streams[0].request.signal.aborted).toBe(false);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(CONTEXT_RENEWAL_MS);
  });
  expect(view.streams[0].request.signal.aborted).toBe(true);
});

test('disabling context events aborts the active stream without reconnecting or reconciling', async () => {
  vi.useFakeTimers();
  const view = setup();
  await ready();
  expect(view.streams).toHaveLength(1);
  const requestsBeforeDisable = view.h.requests.length;

  view.switchTo('a', false);
  expect(view.streams[0].request.signal.aborted).toBe(true);
  expect(view.streams[0].cancel).toHaveBeenCalledOnce();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(120_000);
  });
  expect(view.streams).toHaveLength(1);
  expect(view.h.requests.length).toBe(requestsBeforeDisable);
});
