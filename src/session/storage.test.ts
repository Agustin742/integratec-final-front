import { afterEach, expect, test, vi } from 'vitest';
import { createSession } from './controller';
import { harness, login, memoryStorage, storageKey } from './test-fixtures';

afterEach(() => vi.unstubAllGlobals());

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
