import { afterEach, expect, test, vi } from 'vitest';
import { createSession } from './controller';
import { harness, login, memoryStorage, storageKey } from './test-fixtures';

afterEach(() => vi.unstubAllGlobals());

test('standalone storage validates invalid and valid credentials without a dynamic Function probe', async () => {
  vi.resetModules();
  const { z } = await import('zod');
  const previous = z.config().jitless;
  z.config({ jitless: false });
  const dynamicFunction = vi.fn(function () {
    throw new EvalError('CSP blocks dynamic code');
  });
  vi.stubGlobal('Function', dynamicFunction);
  try {
    const { createSessionStorage, SESSION_STORAGE_KEY } =
      await import('./storage');
    const storage = memoryStorage(JSON.stringify({ accessToken: '' }));
    const session = createSessionStorage(storage);
    expect(session.read()).toEqual({ unavailable: false });
    expect(storage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    const credentials = {
      accessToken: 'synthetic-access',
      refreshToken: 'synthetic-refresh',
      tokenType: 'Bearer' as const,
      expiresIn: 900,
      expiresAt: 900_000,
    };
    expect(session.write(credentials)).toBe(true);
    expect(session.read()).toEqual({ credentials, unavailable: false });
    expect(dynamicFunction).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
    z.config({ jitless: previous });
    vi.resetModules();
  }
});

test('copied credentials require the same tab owner before any protected request', async () => {
  const h = harness();
  const original = createSession({ ...h, tabOwner: () => 'tab-A' });
  expect((await original.controller.login(login)).ok).toBe(true);
  const copied = h.storage.getItem(storageKey)!;
  const childStorage = memoryStorage(copied);
  const child = harness();
  const service = createSession({
    ...child,
    storage: childStorage,
    tabOwner: () => 'tab-B',
  });
  await service.controller.initialize();
  expect(service.controller.getSnapshot()).toEqual({
    status: 'unauthenticated',
  });
  expect(childStorage.getItem(storageKey)).toBeNull();
  expect(child.requests).toHaveLength(0);
  const reload = harness();
  const restored = createSession({
    ...reload,
    storage: memoryStorage(copied),
    tabOwner: () => 'tab-A',
  });
  await restored.controller.initialize();
  expect(restored.controller.getSnapshot().status).toBe('authenticated');
  expect(reload.requests).toHaveLength(1);
});

test.each(['missing', 'throws'] as const)(
  'unavailable tab ownership %s discards before network use',
  async (mode) => {
    const h = harness();
    const original = createSession({ ...h, tabOwner: () => 'tab-A' });
    await original.controller.login(login);
    h.requests.length = 0;
    const service = createSession({
      ...h,
      tabOwner: () => {
        if (mode === 'throws') throw new Error('synthetic unavailable owner');
        return undefined;
      },
    });
    await service.controller.initialize();
    expect(h.storage.getItem(storageKey)).toBeNull();
    expect(service.controller.getSnapshot()).toEqual({
      status: 'unable-to-verify',
    });
    expect(h.requests).toHaveLength(0);
    expect((await service.controller.login(login)).ok).toBe(false);
    expect(h.requests).toHaveLength(0);
  },
);

test('browser ownership preserves an unrelated window name, restores reload and rejects an opener clone', async () => {
  const h = harness();
  const browserWindow = { name: 'unrelated-window-target' };
  vi.stubGlobal('window', browserWindow);
  vi.stubGlobal('sessionStorage', h.storage);
  const options = { baseUrl: h.baseUrl, fetch: h.fetch };
  const original = createSession(options);
  await original.controller.login(login);
  expect(browserWindow.name).toContain('unrelated-window-target');
  const ownerName = browserWindow.name;
  expect(ownerName).not.toContain('synthetic-access');
  expect(ownerName).not.toContain('synthetic-refresh');
  const copied = h.storage.getItem(storageKey)!;
  h.requests.length = 0;
  await createSession(options).controller.initialize();
  expect(h.requests).toHaveLength(1);
  expect(browserWindow.name).toBe(ownerName);
  browserWindow.name = '';
  vi.stubGlobal('sessionStorage', memoryStorage(copied));
  h.requests.length = 0;
  const child = createSession(options);
  await child.controller.initialize();
  expect(child.controller.getSnapshot()).toEqual({ status: 'unauthenticated' });
  expect(h.requests).toHaveLength(0);
});
