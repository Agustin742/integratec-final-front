import { describe, expect, test, vi } from 'vitest';
import { createApiClient, requestApi } from '../api/client';
import { shouldRetryMutation, shouldRetryQuery } from '../api/query-client';
import { createSession } from './controller';
import {
  baseUrl,
  deferred,
  harness,
  json,
  login,
  profile,
  rotated,
  saved,
  storageKey,
  tokens,
} from './test-fixtures';

const isRefresh = (r: Request) => r.url.endsWith('/auth/refresh');

describe('session middleware bounded recovery', () => {
  test('expired access renews once before a read and rotates both credentials', async () => {
    const h = harness((r) => json(isRefresh(r) ? rotated : profile), saved(0));
    const { controller } = createSession(h);
    await controller.initialize();
    expect(h.requests).toHaveLength(2);
    expect(h.requests[0].url).toBe(`${baseUrl}/auth/refresh`);
    expect(h.requests[0].method).toBe('POST');
    expect(h.requests[0].headers.has('Authorization')).toBe(false);
    expect(await h.requests[0].json()).toEqual({
      refreshToken: tokens.refreshToken,
    });
    expect(h.requests[1].headers.get('Authorization')).toBe(
      `Bearer ${rotated.accessToken}`,
    );
    expect(JSON.parse(h.storage.getItem(storageKey)!)).toMatchObject(rotated);
    expect(controller.getSnapshot().status).toBe('authenticated');
  });

  test('concurrent and delayed old-token 401s share exactly one renewal and one replay each', async () => {
    const refresh = deferred<Response>();
    const late = deferred<Response>();
    let oldReads = 0;
    const h = harness((r) => {
      if (isRefresh(r)) return refresh.promise;
      if (r.headers.get('Authorization') === `Bearer ${tokens.accessToken}`) {
        oldReads++;
        return oldReads === 3 ? late.promise : json({}, 401);
      }
      return json(profile);
    }, saved());
    const { client } = createSession(h);
    const reads = [
      client.GET('/users/me'),
      client.GET('/users/me'),
      client.GET('/users/me'),
    ];
    await vi.waitFor(() =>
      expect(h.requests.filter(isRefresh)).toHaveLength(1),
    );
    refresh.resolve(json(rotated));
    await reads[0];
    late.resolve(json({}, 401));
    const results = await Promise.all(reads);
    expect(results.every((r) => r.response.ok)).toBe(true);
    expect(h.requests.filter(isRefresh)).toHaveLength(1);
    expect(h.requests.filter((r) => !isRefresh(r))).toHaveLength(6);
  });

  test.each([401, 400])(
    'definitive refresh rejection %s clears credentials and identity',
    async (status) => {
      const h = harness((r) => json({}, isRefresh(r) ? status : 401), saved());
      const { controller } = createSession(h);
      await controller.initialize();
      expect(controller.getSnapshot()).toEqual({ status: 'unauthenticated' });
      expect(h.storage.getItem(storageKey)).toBeNull();
      expect(h.requests).toHaveLength(2);
    },
  );

  test.each(['offline', '503'])(
    'observed 401 then uncertain refresh %s clears credentials but preserves uncertainty',
    async (failure) => {
      const h = harness((r) => {
        if (isRefresh(r)) {
          if (failure === 'offline') throw new TypeError('synthetic offline');
          return json({}, 503);
        }
        return json({}, 401);
      }, saved());
      const { controller } = createSession(h);
      const release = vi.fn();
      controller.registerCleanup(release);
      await controller.initialize();
      expect(controller.getSnapshot()).toEqual({ status: 'unable-to-verify' });
      expect(h.storage.getItem(storageKey)).toBeNull();
      expect(release).toHaveBeenCalledTimes(1);
      expect(h.requests).toHaveLength(2);
    },
  );

  test.each(['offline', '503'])(
    'expiry-only uncertain refresh %s retains credentials',
    async (failure) => {
      const h = harness(() => {
        if (failure === 'offline') throw new TypeError('synthetic offline');
        return json({}, 503);
      }, saved(0));
      const before = h.storage.getItem(storageKey);
      const { controller } = createSession(h);
      await controller.initialize();
      expect(controller.getSnapshot()).toEqual({ status: 'unable-to-verify' });
      expect(h.storage.getItem(storageKey)).toBe(before);
      expect(h.requests).toHaveLength(1);
    },
  );

  test('a 401 joining an expiry-started refresh upgrades its credential-discard cause', async () => {
    const old = deferred<Response>();
    const refresh = deferred<Response>();
    const h = harness(
      (r) => (isRefresh(r) ? refresh.promise : old.promise),
      saved(100),
    );
    let now = 0;
    const { client, controller } = createSession({ ...h, now: () => now });
    const read = client.GET('/users/me');
    await vi.waitFor(() => expect(h.requests).toHaveLength(1));
    now = 200;
    const expired = client.GET('/users/me');
    const failures = Promise.allSettled([read, expired]);
    await vi.waitFor(() =>
      expect(h.requests.filter(isRefresh)).toHaveLength(1),
    );
    old.resolve(json({}, 401));
    // Let the old response join the still-pending refresh.
    await new Promise((resolve) => setTimeout(resolve, 0));
    refresh.resolve(json({}, 503));
    expect(
      (await failures).every((result) => result.status === 'rejected'),
    ).toBe(true);
    expect(h.storage.getItem(storageKey)).toBeNull();
    expect(controller.getSnapshot()).toEqual({ status: 'unable-to-verify' });
    expect(h.requests).toHaveLength(2);
  });

  test('remaining 401 after renewal clears both credentials without looping', async () => {
    const h = harness(
      (r) => json(isRefresh(r) ? rotated : {}, isRefresh(r) ? 200 : 401),
      saved(),
    );
    const { controller } = createSession(h);
    await controller.initialize();
    expect(h.requests).toHaveLength(3);
    expect(controller.getSnapshot()).toEqual({ status: 'unauthenticated' });
    expect(h.storage.getItem(storageKey)).toBeNull();
  });

  test('403 does not renew or invalidate credentials', async () => {
    const h = harness(() => json({}, 403), saved());
    const before = h.storage.getItem(storageKey);
    const { client } = createSession(h);
    expect((await client.GET('/users/me')).response.status).toBe(403);
    expect(h.requests).toHaveLength(1);
    expect(h.storage.getItem(storageKey)).toBe(before);
  });

  test('never replays a write, even with an arbitrary idempotency header', async () => {
    const h = harness(
      (r) => json(isRefresh(r) ? rotated : {}, isRefresh(r) ? 200 : 401),
      saved(),
    );
    const { client } = createSession(h);
    const result = await client.PATCH('/users/me/profile', {
      body: { displayName: 'New Name' },
      headers: { 'Idempotency-Key': 'synthetic-key' },
    });
    expect(result.response.status).toBe(401);
    expect(h.requests.filter((r) => r.method === 'PATCH')).toHaveLength(1);
    expect(h.requests.filter(isRefresh)).toHaveLength(1);
    expect(h.storage.getItem(storageKey)).toBeNull();
  });

  test('expiry plus a 401 cannot cause a second renewal for the same request', async () => {
    const h = harness(
      (r) => json(isRefresh(r) ? rotated : {}, isRefresh(r) ? 200 : 401),
      saved(0),
    );
    const { controller } = createSession(h);
    await controller.initialize();
    expect(h.requests.filter(isRefresh)).toHaveLength(1);
    expect(h.requests).toHaveLength(2);
    expect(controller.getSnapshot().status).toBe('unauthenticated');
  });

  test('public auth receives no Bearer and never renews', async () => {
    const h = harness(() => json({}, 401), saved());
    const { client } = createSession(h);
    await client.POST('/auth/login', {
      body: login,
      headers: { Authorization: 'Bearer supplied' },
    });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0].headers.has('Authorization')).toBe(false);
  });

  test('off-origin overrides cannot receive any credentials', async () => {
    const h = harness(undefined, saved());
    const { client } = createSession(h);
    await expect(
      client.GET('/users/me', { baseUrl: 'https://other.example.invalid' }),
    ).rejects.toThrow();
    expect(h.fetch).not.toHaveBeenCalled();
  });

  test.each(['caller', 'logout', 'replay'] as const)(
    'public request cancellation during %s is never classified for retry',
    async (mode) => {
      const started = deferred<AbortSignal>();
      let pending = false;
      const h = harness((request) => {
        if (request.url.endsWith('/auth/logout'))
          return new Response(null, { status: 204 });
        if (isRefresh(request)) return json(rotated);
        if (!pending) return json(profile);
        if (
          mode === 'replay' &&
          request.headers.get('Authorization') ===
            `Bearer ${tokens.accessToken}`
        )
          return json({}, 401);
        return new Promise<Response>((_, reject) => {
          request.signal.addEventListener('abort', () =>
            reject(request.signal.reason),
          );
          started.resolve(request.signal);
        });
      }, saved());
      const { controller, client } = createSession(h);
      await controller.initialize();
      const before = h.storage.getItem(storageKey);
      const caller = new AbortController();
      pending = true;
      const result = requestApi(() =>
        client.GET('/users/me', { signal: caller.signal }),
      ).catch((error: unknown) => error);
      const signal = await started.promise;
      const cancellation = new DOMException('Caller cancelled', 'AbortError');
      if (mode === 'logout') await controller.logout();
      else caller.abort(cancellation);
      const error = await result;
      expect(signal.aborted).toBe(true);
      expect(error).toBeInstanceOf(DOMException);
      expect(error).toMatchObject({ name: 'AbortError' });
      if (mode !== 'logout') expect(error).toBe(cancellation);
      expect(shouldRetryQuery(0, error)).toBe(false);
      expect(shouldRetryMutation(0, error, { idempotent: true })).toBe(false);
      expect(h.requests).toHaveLength(
        mode === 'replay' ? 4 : mode === 'logout' ? 3 : 2,
      );
      expect(controller.getSnapshot().status).toBe(
        mode === 'logout' ? 'unauthenticated' : 'authenticated',
      );
      if (mode === 'replay')
        expect(JSON.parse(h.storage.getItem(storageKey)!)).toMatchObject(
          rotated,
        );
      else
        expect(h.storage.getItem(storageKey)).toBe(
          mode === 'logout' ? null : before,
        );
    },
  );

  test('a genuine protected network failure remains retryable without changing session storage', async () => {
    const h = harness(() => {
      throw new TypeError('synthetic offline');
    }, saved());
    const before = h.storage.getItem(storageKey);
    const { controller, client } = createSession(h);
    const error: unknown = await requestApi(() =>
      client.GET('/users/me'),
    ).catch((error: unknown) => error);
    expect(error).toMatchObject({ kind: 'network', status: null });
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(h.requests).toHaveLength(1);
    expect(h.storage.getItem(storageKey)).toBe(before);
    expect(controller.getSnapshot().status).toBe('initializing');
  });

  test('late protected response is aborted after logout even when fetch ignores abort', async () => {
    const old = deferred<Response>();
    const h = harness(
      (r) =>
        r.url.endsWith('/auth/logout')
          ? new Response(null, { status: 204 })
          : old.promise,
      saved(),
    );
    const { controller, client } = createSession(h);
    const read = requestApi(() => client.GET('/users/me'));
    const rejection = expect(read).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.waitFor(() => expect(h.requests).toHaveLength(1));
    await controller.logout();
    old.resolve(json(profile));
    await rejection;
    expect(controller.getSnapshot()).toEqual({ status: 'unauthenticated' });
  });

  test('an old account read cannot escape after a new account authenticates', async () => {
    const old = deferred<Response>();
    const otherProfile = {
      ...profile,
      id: '00000000-0000-4000-8000-000000000002',
      email: 'other@example.test',
    };
    const h = harness(
      (r) =>
        r.url.endsWith('/auth/login')
          ? json(rotated)
          : r.headers.get('Authorization') === `Bearer ${tokens.accessToken}`
            ? old.promise
            : json(otherProfile),
      saved(),
    );
    const { controller, client } = createSession(h);
    const read = client.GET('/users/me');
    const rejection = expect(read).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.waitFor(() => expect(h.requests).toHaveLength(1));
    await controller.login(login);
    old.resolve(json(profile));
    await rejection;
    expect(controller.getSnapshot()).toEqual({
      status: 'authenticated',
      user: otherProfile,
    });
    expect(JSON.parse(h.storage.getItem(storageKey)!)).toMatchObject(rotated);
  });

  test('a session change while the response body streams aborts the parsed result', async () => {
    const body = deferred<ReadableStreamDefaultController<Uint8Array>>();
    const h = harness(
      (r) =>
        r.url.endsWith('/auth/logout')
          ? new Response(null, { status: 204 })
          : new Response(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  body.resolve(controller);
                },
              }),
            ),
      saved(),
    );
    const { controller, client } = createSession(h);
    const read = client.GET('/users/me');
    const rejection = expect(read).rejects.toMatchObject({
      name: 'AbortError',
    });
    const stream = await body.promise;
    await controller.logout();
    stream.enqueue(new TextEncoder().encode(JSON.stringify(profile)));
    stream.close();
    await rejection;
    expect(h.storage.getItem(storageKey)).toBeNull();
  });

  test('late refresh cannot overwrite the new account', async () => {
    const old = deferred<Response>();
    const h = harness(
      (r) =>
        isRefresh(r)
          ? old.promise
          : r.url.endsWith('/auth/login')
            ? json(rotated)
            : r.headers.get('Authorization') === `Bearer ${tokens.accessToken}`
              ? json({}, 401)
              : json(profile),
      saved(),
    );
    const { controller } = createSession(h);
    const initializing = controller.initialize();
    await vi.waitFor(() =>
      expect(h.requests.filter(isRefresh)).toHaveLength(1),
    );
    await controller.login(login);
    old.resolve(json({ ...tokens, accessToken: 'old-refreshed' }));
    await initializing;
    expect(controller.getSnapshot()).toEqual({
      status: 'authenticated',
      user: profile,
    });
    expect(JSON.parse(h.storage.getItem(storageKey)!)).toMatchObject(rotated);
  });

  test('late logout completion cannot clear a newer account', async () => {
    const old = deferred<Response>();
    const h = harness(
      (r) =>
        r.url.endsWith('/auth/logout')
          ? old.promise
          : json(r.url.endsWith('/users/me') ? profile : rotated),
      saved(),
    );
    const { controller } = createSession(h);
    const loggingOut = controller.logout();
    await controller.login(login);
    old.resolve(new Response(null, { status: 204 }));
    expect((await loggingOut).serverConfirmed).toBe(false);
    expect(controller.getSnapshot()).toEqual({
      status: 'authenticated',
      user: profile,
    });
    expect(JSON.parse(h.storage.getItem(storageKey)!)).toMatchObject(rotated);
  });

  test('malformed refresh success never authenticates or persists its payload', async () => {
    const h = harness(
      (r) =>
        json(
          isRefresh(r) ? { ...rotated, refreshToken: null } : {},
          isRefresh(r) ? 200 : 401,
        ),
      saved(),
    );
    const { controller } = createSession(h);
    await controller.initialize();
    expect(controller.getSnapshot()).toEqual({ status: 'unable-to-verify' });
    expect(h.storage.getItem(storageKey)).toBeNull();
  });

  test('existing unauthenticated API clients remain unchanged', async () => {
    const h = harness(() => json(profile));
    await createApiClient(h).GET('/users/me');
    expect(h.requests[0].headers.has('Authorization')).toBe(false);
    expect(h.requests).toHaveLength(1);
  });
});
