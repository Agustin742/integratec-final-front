import { fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useContext, useEffect, useState } from 'react';
import { expect, test } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { render } from '@/test/render';
import {
  ClaimedNotificationCenter,
  HostContext,
  NotificationHostProvider,
  ShellNotificationCenter,
  useNotificationHostClaimed,
} from './notification-host';

function Harness() {
  const [claimed, setClaimed] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setClaimed((value) => !value)}>
        toggle
      </button>
      <header data-testid="shell">
        <ShellNotificationCenter />
      </header>
      {claimed && (
        <nav data-testid="bar">
          <ClaimedNotificationCenter />
        </nav>
      )}
    </>
  );
}

function renderHarness() {
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async () =>
        Response.json({ items: [], page: 1, pageSize: 20, total: 0 }),
    }),
  );
  return render(
    <ApiQueryProvider client={createAppQueryClient()}>
      <SessionProvider service={session.service}>
        <MemoryRouter>
          <NotificationHostProvider>
            <Harness />
          </NotificationHostProvider>
        </MemoryRouter>
      </SessionProvider>
    </ApiQueryProvider>,
  );
}

test('only one notification center is mounted at a time: the claimant replaces the shell one and hands it back', async () => {
  renderHarness();
  const bells = () =>
    screen.queryAllByRole('button', { name: /Notificaciones/ });

  expect(await screen.findByTestId('shell')).toContainElement(bells()[0]!);
  expect(bells()).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
  const bar = await screen.findByTestId('bar');
  expect(
    await screen.findAllByRole('button', { name: /Notificaciones/ }),
  ).toHaveLength(1);
  expect(bar).toContainElement(bells()[0]!);

  fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
  expect(await screen.findByTestId('shell')).toContainElement(
    (await screen.findAllByRole('button', { name: /Notificaciones/ }))[0]!,
  );
  expect(bells()).toHaveLength(1);
});

test('renders on its own when no host is mounted', async () => {
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async () =>
        Response.json({ items: [], page: 1, pageSize: 20, total: 0 }),
    }),
  );
  render(
    <ApiQueryProvider client={createAppQueryClient()}>
      <SessionProvider service={session.service}>
        <ClaimedNotificationCenter />
      </SessionProvider>
    </ApiQueryProvider>,
  );
  expect(
    await screen.findByRole('button', { name: /Notificaciones/ }),
  ).toBeVisible();
});

test('keeps claim reference stable across claim/release transitions without re-claim churn', async () => {
  const seenClaims: Array<() => () => void> = [];
  let effectRuns = 0;
  let cleanupRuns = 0;

  function ClaimStabilityHarness() {
    const [mounted, setMounted] = useState(false);
    const host = useContext(HostContext);
    const claimed = useNotificationHostClaimed();
    const claim = host?.claim;

    if (claim) {
      seenClaims.push(claim);
    }

    useEffect(() => {
      if (!claim) return;
      effectRuns += 1;
      return () => {
        cleanupRuns += 1;
      };
    }, [claim]);

    return (
      <>
        <button type="button" onClick={() => setMounted((v) => !v)}>
          toggle-claimant
        </button>
        <output data-testid="claimed-flag">{String(claimed)}</output>
        {mounted && <ClaimedNotificationCenter />}
      </>
    );
  }

  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async () =>
        Response.json({ items: [], page: 1, pageSize: 20, total: 0 }),
    }),
  );
  const view = render(
    <ApiQueryProvider client={createAppQueryClient()}>
      <SessionProvider service={session.service}>
        <MemoryRouter>
          <NotificationHostProvider>
            <ClaimStabilityHarness />
          </NotificationHostProvider>
        </MemoryRouter>
      </SessionProvider>
    </ApiQueryProvider>,
  );

  expect(screen.getByTestId('claimed-flag')).toHaveTextContent('false');
  expect(effectRuns).toBe(1);
  expect(cleanupRuns).toBe(0);

  fireEvent.click(screen.getByRole('button', { name: 'toggle-claimant' }));
  expect(
    await screen.findByRole('button', { name: /Notificaciones/ }),
  ).toBeVisible();
  expect(screen.getByTestId('claimed-flag')).toHaveTextContent('true');
  expect(effectRuns).toBe(1);
  expect(cleanupRuns).toBe(0);

  fireEvent.click(screen.getByRole('button', { name: 'toggle-claimant' }));
  expect(screen.getByTestId('claimed-flag')).toHaveTextContent('false');
  expect(effectRuns).toBe(1);
  expect(cleanupRuns).toBe(0);
  expect(seenClaims.length).toBeGreaterThanOrEqual(3);
  expect(seenClaims.every((fn) => fn === seenClaims[0])).toBe(true);

  view.unmount();
  expect(cleanupRuns).toBe(1);
});
