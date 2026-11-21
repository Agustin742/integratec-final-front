import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import {
  createChatInboxStore,
  TEST_API_BASE_URL,
  type ChatInboxStoreMessage,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ChatsNavLink } from './chats-nav-link';

const OTHER_ID = '00000000-0000-4000-8000-000000007002';
const CLASSROOM = '00000000-0000-4000-8000-000000000051';

function messages(count: number): ChatInboxStoreMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-6000000${String(index).padStart(5, '0')}`,
    authorId: OTHER_ID,
    authorDisplayName: 'Sofía Martínez',
    body: `Mensaje ${index}`,
    createdAt: new Date(
      Date.parse('2026-11-19T03:00:00.000Z') + index * 60_000,
    ).toISOString(),
  }));
}

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function setup(
  options: { unread?: number; parent?: boolean; empty?: boolean } = {},
) {
  const store = createChatInboxStore({
    currentUserId: profile.id,
    parent: options.parent,
    classrooms:
      options.empty === true
        ? []
        : [
            {
              classroomId: CLASSROOM,
              classroomName: 'Matemática',
              messages: messages(options.unread ?? 3),
            },
          ],
  });
  mswServer.use(...store.handlers);
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({ baseUrl: TEST_API_BASE_URL }),
  );
  render(
    <SessionProvider service={session.service}>
      <ApiQueryProvider
        client={createAppQueryClient({
          defaultOptions: { queries: { retry: false } },
        })}
      >
        <MemoryRouter initialEntries={['/']}>
          <ChatsNavLink />
          <Routes>
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </ApiQueryProvider>
    </SessionProvider>,
  );
  return store;
}

describe('ChatsNavLink', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('links to the chats page with the total unread count in its name', async () => {
    setup({ unread: 3 });
    const link = await screen.findByRole('link', {
      name: 'Mensajes, 3 mensajes sin leer',
    });
    expect(link).toHaveAttribute('href', '/chats');
    expect(link).toHaveTextContent('3');
    fireEvent.click(link);
    expect(screen.getByTestId('where')).toHaveTextContent('/chats');
  });

  it('caps the visible badge at 99+ but names the real count', async () => {
    setup({ unread: 120 });
    const link = await screen.findByRole('link', {
      name: 'Mensajes, 120 mensajes sin leer',
    });
    expect(link).toHaveTextContent('99+');
  });

  it('has no badge when everything is read', async () => {
    setup({ unread: 0 });
    const link = await screen.findByRole('link', { name: 'Mensajes' });
    expect(link).not.toHaveTextContent(/\d/);
  });

  it('is hidden for users without chats', async () => {
    const empty = setup({ empty: true });
    await waitFor(() => {
      expect(empty.getCounts().list).toBe(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('link', { name: /Mensajes/ })).toBeNull();
  });

  it('is hidden for parents', async () => {
    const store = setup({ parent: true });
    await waitFor(() => {
      expect(store.getCounts().list).toBe(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('link', { name: /Mensajes/ })).toBeNull();
  });
});
