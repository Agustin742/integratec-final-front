import { StrictMode, useEffect, type ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ApiQueryProvider, createAppQueryClient } from '../api/query-client';
import { createSession, type SessionService } from './controller';
import {
  AuthenticatedContent,
  SessionProvider,
  useSessionCleanup,
  useSessionService,
  useSessionSnapshot,
} from './provider';
import {
  deferred,
  harness,
  json,
  login,
  profile,
  saved,
  storageKey,
  tokens,
} from './test-fixtures';

function Probe({ release = () => {} }: { release?: () => void }) {
  const snapshot = useSessionSnapshot();
  useSessionCleanup(release);
  return (
    <>
      <output>{snapshot.status}</output>
      <AuthenticatedContent fallback={<p role="status">Waiting</p>}>
        <p>Private content</p>
      </AuthenticatedContent>
    </>
  );
}
function mount(service: SessionService, children: ReactNode = <Probe />) {
  const queryClient = createAppQueryClient();
  const tree = (current: SessionService) => (
    <StrictMode>
      <ApiQueryProvider client={queryClient}>
        <SessionProvider service={current}>{children}</SessionProvider>
      </ApiQueryProvider>
    </StrictMode>
  );
  return { ...render(tree(service)), queryClient, tree };
}

test('StrictMode owns initialization and subscriptions, not hook reads or rerenders', async () => {
  const response = deferred<Response>();
  const fixture = harness(() => response.promise, saved());
  const service = createSession(fixture);
  const initialize = vi.spyOn(service.controller, 'initialize');
  const active = new Set<() => void>();
  const subscribe = service.controller.subscribe;
  vi.spyOn(service.controller, 'subscribe').mockImplementation((listener) => {
    active.add(listener);
    const unsubscribe = subscribe(listener);
    return () => {
      active.delete(listener);
      unsubscribe();
    };
  });
  let exposed: SessionService | undefined;
  function Reader() {
    const current = useSessionService();
    useEffect(() => {
      exposed = current;
    }, [current]);
    return <Probe />;
  }
  const view = mount(service, <Reader />);
  expect(exposed).toBe(service);
  expect(screen.queryByText('Private content')).not.toBeInTheDocument();
  expect(active.size).toBe(2);
  await waitFor(() => expect(fixture.fetch).toHaveBeenCalledTimes(1));
  expect(initialize).toHaveBeenCalledTimes(2);
  initialize.mockClear();
  view.rerender(view.tree(service));
  expect(initialize).not.toHaveBeenCalled();
  expect(fixture.fetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    response.resolve(json(profile));
    await service.controller.initialize();
  });
  expect(screen.getByText('authenticated')).toBeInTheDocument();
  expect(screen.getByText('Private content')).toBeInTheDocument();
  view.unmount();
  expect(active.size).toBe(0);
});

test.each(['unauthenticated', 'unable-to-verify'] as const)(
  'withholds protected children for %s',
  async (status) => {
    const fixture = harness(
      () => {
        throw new TypeError('Offline');
      },
      status === 'unable-to-verify' ? saved() : undefined,
    );
    const service = createSession(fixture);
    let privateRenders = 0;
    function Private() {
      privateRenders++;
      return <p>Private content</p>;
    }
    mount(
      service,
      <>
        <Probe />
        <AuthenticatedContent fallback={<p role="status">Unavailable</p>}>
          <Private />
        </AuthenticatedContent>
      </>,
    );
    await screen.findByText(status);
    expect(screen.getByText('Unavailable')).toHaveAttribute('role', 'status');
    expect(screen.queryByText('Private content')).not.toBeInTheDocument();
    expect(privateRenders).toBe(0);
    expect(fixture.fetch).toHaveBeenCalledTimes(
      status === 'unauthenticated' ? 0 : 1,
    );
  },
);

test.each(['logout', 'account change'] as const)(
  '%s synchronously cancels and clears caches, releases private owners and fences late data',
  async (action) => {
    const nextProfile = {
      ...profile,
      id: '00000000-0000-4000-8000-000000000002',
      email: 'next@example.test',
    };
    let switched = false;
    const fixture = harness((request) => {
      if (request.url.endsWith('/users/me'))
        return json(switched ? nextProfile : profile);
      if (request.url.endsWith('/auth/logout'))
        return new Response(null, { status: 204 });
      switched = true;
      return json(tokens);
    }, saved());
    const service = createSession(fixture);
    let privateState: typeof profile | undefined = profile;
    const release = vi.fn(() => {
      privateState = undefined;
    });
    const view = mount(service, <Probe release={release} />);
    await screen.findByText('authenticated');
    // StrictMode's setup/cleanup probe also releases private owners.
    release.mockClear();
    const late = deferred<string>();
    let signal: AbortSignal | undefined;
    const pending = view.queryClient
      .fetchQuery({
        queryKey: ['private', profile.id],
        queryFn: (context) => {
          signal = context.signal;
          return late.promise;
        },
      })
      .catch(() => 'cancelled');
    view.queryClient.setQueryData(['private', 'cached'], profile);
    const mutation = view.queryClient
      .getMutationCache()
      .build(view.queryClient, {
        mutationKey: ['private'],
        mutationFn: async () => profile,
      });
    await mutation.execute(undefined);
    expect(mutation.state.data).toEqual(profile);
    let observed = false;
    const unregister = service.controller.registerCleanup(() => {
      observed = true;
      expect(signal?.aborted).toBe(true);
      expect(view.queryClient.getQueryCache().getAll()).toHaveLength(0);
      expect(view.queryClient.getMutationCache().getAll()).toHaveLength(0);
      expect(fixture.storage.getItem(storageKey)).toBeNull();
      expect(service.controller.getSnapshot().status).not.toBe('authenticated');
    });
    let transition!: Promise<unknown>;
    act(() => {
      transition =
        action === 'logout'
          ? service.controller.logout()
          : service.controller.login(login);
      expect(observed).toBe(true);
      expect(release).toHaveBeenCalledTimes(1);
      expect(privateState).toBeUndefined();
    });
    expect(screen.queryByText('Private content')).not.toBeInTheDocument();
    expect(service.controller.getCleanupFailure()).toBe(false);
    await act(async () => {
      late.resolve('old account');
      await pending;
      await transition;
    });
    expect(view.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(view.queryClient.getMutationCache().getAll()).toHaveLength(0);
    if (action === 'logout')
      expect(fixture.storage.getItem(storageKey)).toBeNull();
    else
      expect(service.controller.getSnapshot()).toMatchObject({
        status: 'authenticated',
        user: nextProfile,
      });
    unregister();
    view.unmount();
    await service.controller.logout();
    expect(release).toHaveBeenCalledTimes(2);
  },
);

test('service replacement and unmount unregister only their own cleanup owners', async () => {
  const first = createSession(harness());
  const second = createSession(harness());
  const release = vi.fn();
  const view = mount(first, <Probe release={release} />);
  await screen.findByText('unauthenticated');
  view.rerender(view.tree(second));
  await screen.findByText('unauthenticated');
  view.queryClient.setQueryData(['new owner'], 'preserve');
  await act(async () => {
    await first.controller.logout();
  });
  expect(view.queryClient.getQueryData(['new owner'])).toBe('preserve');
  expect(release).toHaveBeenCalledTimes(2); // StrictMode probe and A replacement.
  release.mockClear();
  await act(async () => {
    await second.controller.logout();
  });
  expect(view.queryClient.getQueryData(['new owner'])).toBeUndefined();
  expect(release).toHaveBeenCalledTimes(1);
  view.unmount();
  view.queryClient.setQueryData(['after unmount'], 'preserve');
  await second.controller.logout();
  expect(view.queryClient.getQueryData(['after unmount'])).toBe('preserve');
  expect(release).toHaveBeenCalledTimes(2);
});

test('protected 401 and uncertain refresh remove tokens, caches and private owners', async () => {
  let rejected = false;
  const fixture = harness(
    (request) =>
      request.url.endsWith('/auth/refresh')
        ? json({}, 503)
        : json(rejected ? {} : profile, rejected ? 401 : 200),
    saved(),
  );
  const service = createSession(fixture);
  const release = vi.fn();
  const view = mount(service, <Probe release={release} />);
  await screen.findByText('authenticated');
  release.mockClear();
  view.queryClient.setQueryData(['private'], profile);
  await view.queryClient
    .getMutationCache()
    .build(view.queryClient, { mutationFn: async () => profile })
    .execute(undefined);
  rejected = true;
  await act(async () => {
    await expect(service.client.GET('/users/me')).rejects.toThrow();
  });
  expect(screen.getByText('unable-to-verify')).toBeInTheDocument();
  expect(screen.queryByText('Private content')).not.toBeInTheDocument();
  expect(fixture.storage.getItem(storageKey)).toBeNull();
  expect(view.queryClient.getQueryCache().getAll()).toHaveLength(0);
  expect(view.queryClient.getMutationCache().getAll()).toHaveLength(0);
  expect(release).toHaveBeenCalledTimes(1);
});

test('authenticated replacement clears caches before B renders and releases only A ownership', async () => {
  const first = createSession(harness(undefined, saved()));
  const secondProfile = {
    ...profile,
    id: '00000000-0000-4000-8000-000000000002',
  };
  const second = createSession(harness(() => json(secondProfile), saved()));
  await first.controller.initialize();
  await second.controller.initialize();
  const queryClient = createAppQueryClient();
  const releaseA = vi.fn();
  const releaseB = vi.fn();
  const observations: number[] = [];
  function Owner() {
    const service = useSessionService();
    useSessionCleanup(service === first ? releaseA : releaseB);
    const snapshot = useSessionSnapshot();
    if (service === second)
      observations.push(
        queryClient.getQueryCache().getAll().length +
          queryClient.getMutationCache().getAll().length,
      );
    return (
      <p>
        {snapshot.status === 'authenticated'
          ? snapshot.user.id
          : snapshot.status}
      </p>
    );
  }
  const tree = (service: SessionService) => (
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={service}>
        <Owner />
      </SessionProvider>
    </ApiQueryProvider>
  );
  const view = render(tree(first));
  queryClient.setQueryData(['private', 'A'], profile);
  const late = deferred<string>();
  let signal: AbortSignal | undefined;
  let started = 0;
  const pending = queryClient
    .fetchQuery({
      queryKey: ['pending', 'A'],
      queryFn: (context) => {
        started++;
        signal = context.signal;
        return late.promise;
      },
    })
    .catch(() => 'cancelled');
  await queryClient
    .getMutationCache()
    .build(queryClient, { mutationFn: async () => profile })
    .execute(undefined);
  expect(started).toBe(1);
  expect(queryClient.getMutationCache().getAll()).toHaveLength(1);
  view.rerender(tree(second));
  expect(screen.getByText(secondProfile.id)).toBeInTheDocument();
  expect(observations.length).toBeGreaterThan(0);
  expect(observations.every((count) => count === 0)).toBe(true);
  expect(signal?.aborted).toBe(true);
  expect(releaseA).toHaveBeenCalledTimes(1);
  expect(releaseB).not.toHaveBeenCalled();
  queryClient.setQueryData(['private', 'B'], secondProfile);
  await act(async () => {
    await first.controller.logout();
  });
  expect(queryClient.getQueryData(['private', 'B'])).toEqual(secondProfile);
  late.resolve('late A');
  await pending;
  expect(queryClient.getQueryData(['pending', 'A'])).toBeUndefined();
  view.unmount();
  expect(releaseB).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  queryClient.setQueryData(['detached'], 'preserve');
  await second.controller.logout();
  expect(queryClient.getQueryData(['detached'])).toBe('preserve');
});

test('cleanup exceptions remain safely observable without skipping other owners', async () => {
  const service = createSession(harness());
  const failing = () => {
    throw new Error('Synthetic cleanup failure');
  };
  const view = mount(service, <Probe release={failing} />);
  await screen.findByText('unauthenticated');
  const release = vi.fn();
  const unregister = service.controller.registerCleanup(release);
  view.queryClient.setQueryData(['private'], 'private');
  await act(async () => {
    expect(await service.controller.logout()).toMatchObject({
      cleanupFailed: true,
    });
  });
  expect(service.controller.getCleanupFailure()).toBe(true);
  expect(release).toHaveBeenCalledTimes(1);
  expect(view.queryClient.getQueryData(['private'])).toBeUndefined();
  unregister();
});
