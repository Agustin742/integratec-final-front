import { describe, expect, test, vi } from 'vitest';
import { createSession } from './controller';
import {
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

describe('session lifecycle public boundary', () => {
  test('starts unresolved, subscribes and reconstructs identity only from /users/me', async () => {
    const pending = deferred<Response>();
    const h = harness(() => pending.promise, saved());
    const { controller } = createSession(h);
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    expect(controller.getSnapshot()).toEqual({ status: 'initializing' });
    expect(h.fetch).not.toHaveBeenCalled();
    const initializing = controller.initialize();
    expect(controller.getSnapshot()).toEqual({ status: 'initializing' });
    pending.resolve(json(profile));
    await initializing;
    expect(controller.getSnapshot()).toEqual({
      status: 'authenticated',
      user: profile,
    });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0].method).toBe('GET');
    expect(h.requests[0].headers.get('Authorization')).toBe(
      `Bearer ${tokens.accessToken}`,
    );
    expect(h.storage.getItem(storageKey)).not.toContain(profile.email);
    expect(JSON.stringify(controller.getSnapshot())).not.toContain(
      tokens.accessToken,
    );
    unsubscribe();
    const calls = listener.mock.calls.length;
    await controller.logout();
    expect(listener).toHaveBeenCalledTimes(calls);
  });

  test('missing storage resolves unauthenticated without a request', async () => {
    const h = harness();
    const { controller } = createSession(h);
    await controller.initialize();
    expect(controller.getSnapshot()).toEqual({ status: 'unauthenticated' });
    expect(h.fetch).not.toHaveBeenCalled();
  });

  test.each([
    'not json',
    JSON.stringify({ ...tokens, refreshToken: '' }),
    JSON.stringify({ user: profile }),
  ])('rejects malformed persisted credentials: %s', async (raw) => {
    const h = harness(undefined, raw);
    const { controller } = createSession(h);
    await controller.initialize();
    expect(controller.getSnapshot()).toEqual({ status: 'unauthenticated' });
    expect(h.storage.getItem(storageKey)).toBeNull();
    expect(h.fetch).not.toHaveBeenCalled();
  });

  test('unavailable storage fails closed without leaking its exception', async () => {
    const h = harness();
    h.storage.getItem = () => {
      throw new Error('synthetic-sensitive-storage-error');
    };
    const { controller } = createSession(h);
    await controller.initialize();
    expect(controller.getSnapshot()).toEqual({ status: 'unable-to-verify' });
    expect(h.fetch).not.toHaveBeenCalled();
  });

  test('login persists rotated DTO credentials and verifies the profile', async () => {
    const h = harness();
    const { controller } = createSession(h);
    expect(await controller.login(login)).toMatchObject({
      ok: true,
      cleanupFailed: false,
    });
    expect(controller.getSnapshot()).toEqual({
      status: 'authenticated',
      user: profile,
    });
    expect(h.requests.map((r) => r.method)).toEqual(['POST', 'GET']);
    expect(await h.requests[0].json()).toEqual(login);
    expect(h.requests[0].headers.has('Authorization')).toBe(false);
    expect(JSON.parse(h.storage.getItem(storageKey)!)).toMatchObject(tokens);
  });

  test.each([
    { ...tokens, expiresIn: '900' },
    { ...tokens, accessToken: '' },
    { ...tokens, tokenType: 'Basic' },
  ])('rejects malformed successful auth payloads', async (payload) => {
    const h = harness(() => json(payload));
    const { controller } = createSession(h);
    expect(await controller.login(login)).toMatchObject({ ok: false });
    expect(controller.getSnapshot().status).toBe('unable-to-verify');
    expect(h.storage.getItem(storageKey)).toBeNull();
    expect(h.requests).toHaveLength(1);
  });

  test('malformed profile never authenticates', async () => {
    const h = harness(() => json({ ...profile, avatar: null }), saved());
    const { controller } = createSession(h);
    await controller.initialize();
    expect(controller.getSnapshot()).toEqual({ status: 'unable-to-verify' });
  });

  test('initialization network error is uncertain and preserves credentials', async () => {
    const h = harness(() => {
      throw new TypeError('synthetic offline');
    }, saved());
    const before = h.storage.getItem(storageKey);
    const { controller } = createSession(h);
    await controller.initialize();
    expect(controller.getSnapshot()).toEqual({ status: 'unable-to-verify' });
    expect(h.storage.getItem(storageKey)).toBe(before);
  });

  test('initialization recovers after refresh succeeds but profile verification returns 503', async () => {
    let recovered = false;
    const h = harness((request) => {
      if (request.url.endsWith('/auth/refresh')) return json(rotated);
      return recovered ? json(profile) : json({}, 503);
    }, saved(0));
    const { controller } = createSession(h);
    await controller.initialize();
    expect(controller.getSnapshot()).toEqual({ status: 'unable-to-verify' });
    const stored = h.storage.getItem(storageKey);
    expect(JSON.parse(stored!)).toMatchObject(rotated);
    expect(h.requests).toHaveLength(2);
    expect(await h.requests[0].json()).toEqual({
      refreshToken: tokens.refreshToken,
    });
    recovered = true;
    await controller.initialize();
    expect(controller.getSnapshot()).toEqual({
      status: 'authenticated',
      user: profile,
    });
    expect(h.requests).toHaveLength(3);
    expect(
      h.requests
        .slice(1)
        .every(
          (request) =>
            request.headers.get('Authorization') ===
            `Bearer ${rotated.accessToken}`,
        ),
    ).toBe(true);
    expect(h.storage.getItem(storageKey)).toBe(stored);
  });

  test('credentials never reach localStorage, logs, URLs, snapshots or transport errors', async () => {
    const local = vi
      .spyOn(globalThis, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new Error('forbidden storage');
      });
    const logs = ['log', 'warn', 'error'].map((method) =>
      vi
        .spyOn(console, method as 'log' | 'warn' | 'error')
        .mockImplementation(() => {}),
    );
    try {
      const h = harness((request) => {
        if (request.url.endsWith('/users/me'))
          throw new Error(tokens.accessToken);
        return json(tokens);
      });
      const { controller, client } = createSession(h);
      await controller.login(login);
      await expect(client.GET('/users/me')).rejects.toSatisfy(
        (error: unknown) => !JSON.stringify(error).includes(tokens.accessToken),
      );
      await controller.logout();
      expect(local).not.toHaveBeenCalled();
      for (const log of logs) expect(log).not.toHaveBeenCalled();
      for (const request of h.requests) {
        expect(request.url).not.toContain(tokens.accessToken);
        expect(request.url).not.toContain(tokens.refreshToken);
      }
      expect(JSON.stringify(controller.getSnapshot())).not.toContain(
        tokens.refreshToken,
      );
    } finally {
      local.mockRestore();
      for (const log of logs) log.mockRestore();
    }
  });

  test('storage write failure cannot authenticate', async () => {
    const h = harness();
    h.storage.setItem = () => {
      throw new Error('unavailable');
    };
    const { controller } = createSession(h);
    expect(await controller.login(login)).toMatchObject({ ok: false });
    expect(controller.getSnapshot()).toEqual({ status: 'unable-to-verify' });
    expect(h.storage.getItem(storageKey)).toBeNull();
  });

  test('logout clears local state immediately, runs all owned cleanup, and reports unconfirmed', async () => {
    const pending = deferred<Response>();
    const h = harness(
      (r) => (r.url.endsWith('/auth/logout') ? pending.promise : json(profile)),
      saved(),
    );
    const { controller } = createSession(h);
    await controller.initialize();
    const removed = vi.fn();
    const unregister = controller.registerCleanup(removed);
    unregister();
    controller.registerCleanup(() => {
      throw new Error('synthetic-private-error');
    });
    const cleanup = vi.fn();
    controller.registerCleanup(cleanup);
    const loggingOut = controller.logout();
    expect(controller.getSnapshot()).toEqual({ status: 'unauthenticated' });
    expect(h.storage.getItem(storageKey)).toBeNull();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(removed).not.toHaveBeenCalled();
    pending.resolve(json({}, 503));
    expect(await loggingOut).toEqual({
      serverConfirmed: false,
      cleanupFailed: true,
    });
    const request = h.requests.find((r) => r.url.endsWith('/auth/logout'))!;
    expect(request.method).toBe('POST');
    expect(request.headers.get('Authorization')).toBe(
      `Bearer ${tokens.accessToken}`,
    );
    expect(await request.text()).toBe('');
  });

  test('automatic invalidation reports cleanup failure without retaining credentials or skipping owners', async () => {
    let denied = false;
    const h = harness(
      () => json(denied ? {} : profile, denied ? 401 : 200),
      saved(),
    );
    const { controller, client } = createSession(h);
    await controller.initialize();
    controller.registerCleanup(() => {
      throw new Error('synthetic-private-cleanup');
    });
    const remaining = vi.fn();
    controller.registerCleanup(remaining);
    denied = true;
    await expect(client.GET('/users/me')).rejects.toThrow();
    expect(controller.getSnapshot()).toEqual({ status: 'unauthenticated' });
    expect(h.storage.getItem(storageKey)).toBeNull();
    expect(remaining).toHaveBeenCalledOnce();
    expect(controller.getCleanupFailure()).toBe(true);
  });

  test('logout confirms only a successful server response', async () => {
    const h = harness(undefined, saved());
    const { controller } = createSession(h);
    await controller.initialize();
    expect(await controller.logout()).toEqual({
      serverConfirmed: true,
      cleanupFailed: false,
    });
  });

  test('logout does not confirm an unexpected successful status', async () => {
    const h = harness(() => json({}, 200), saved());
    const { controller } = createSession(h);
    expect((await controller.logout()).serverConfirmed).toBe(false);
    expect(h.storage.getItem(storageKey)).toBeNull();
  });

  test('late login cannot replace a newer account', async () => {
    const old = deferred<Response>();
    let logins = 0;
    const h = harness((r) =>
      r.url.endsWith('/auth/login') && ++logins === 1
        ? old.promise
        : json(r.url.endsWith('/users/me') ? profile : tokens),
    );
    const { controller } = createSession(h);
    const first = controller.login(login);
    await vi.waitFor(() => expect(h.requests).toHaveLength(1));
    await controller.login(login);
    old.resolve(json({ ...tokens, accessToken: 'old-account' }));
    expect(await first).toMatchObject({ ok: false });
    expect(controller.getSnapshot()).toEqual({
      status: 'authenticated',
      user: profile,
    });
    expect(h.storage.getItem(storageKey)).not.toContain('old-account');
  });
});
