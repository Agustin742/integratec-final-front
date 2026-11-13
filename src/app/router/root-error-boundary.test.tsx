import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import { messages } from '../messages';
import { fakeSession } from './fake-session';
import { reloadPage } from './reload';
import { createAppRoutes } from './routes';

const SECRET = 'shell-internal-detail';

vi.mock('./reload', () => ({ reloadPage: vi.fn() }));
// The toast host lives in the shell: making it throw takes the whole shell down.
vi.mock('@/components/ui/toast', () => ({
  Toast: () => {
    throw new Error('shell-internal-detail');
  },
}));

// The root fallback is the last resort, so it must not depend on shared
// primitives: if one of them is what broke, rendering it would throw again.
vi.mock('@/components/feedback/states', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/feedback/states')>()),
  ErrorState: () => {
    throw new Error('shared-primitive-broken');
  },
}));
vi.mock('@/components/ui/button', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/ui/button')>()),
  Button: () => {
    throw new Error('shared-primitive-broken');
  },
}));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('renders a minimal fallback with no shell, even when shared primitives throw', async () => {
  const session = fakeSession({ status: 'authenticated', user: profile });
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: ['/'],
  });
  const { container } = render(
    <SessionProvider service={session.service}>
      <RouterProvider router={router} />
    </SessionProvider>,
  );

  expect(await screen.findByRole('alert')).toHaveTextContent(
    messages.errors.root.title,
  );
  expect(screen.getByRole('main')).toBeVisible();
  await waitFor(() =>
    expect(document.title).toBe(
      `${messages.errors.root.title} · ${messages.title}`,
    ),
  );
  expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  expect(document.body).not.toHaveTextContent(SECRET);
  expect(
    screen.getByRole('link', { name: messages.errors.goHome }),
  ).toHaveAttribute('href', '/');
  await expectAccessible(container);

  fireEvent.click(screen.getByRole('button', { name: messages.errors.reload }));
  expect(reloadPage).toHaveBeenCalledTimes(1);
});
