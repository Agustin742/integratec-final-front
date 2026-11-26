import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import { fakeSession } from '@/app/router/fake-session';
import { Toast } from '@/components/ui/toast';
import { familyMessages } from '@/features/family/messages';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createClassroomDetailHandler,
  createClassroomInvitationsStore,
  createParentLinkMessagesHandler,
  createSendParentLinkMessageHandler,
  type ClassroomDetailPayload,
  type ClassroomParentLinkPayload,
  type ParentLinkMessagePayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ClassroomFamiliesPanel } from './classroom-families-panel';
import { classroomMessages } from './messages';

vi.setConfig({ testTimeout: 20_000 });

const classroomId = '3a2b1c4d-0000-4000-8000-000000000044';
const copy = classroomMessages.invitations;

function createStaffDetailHandler(
  overrides: Partial<ClassroomDetailPayload> = {},
) {
  return createClassroomDetailHandler(classroomId, {
    name: '4.º Año A - Matemática',
    myRole: 'TEACHER',
    capabilities: ['invite_members', 'list_directory', 'publish_content'],
    ...overrides,
  });
}

function renderFamiliesPanel(
  options: { readonly queryClient?: QueryClient } = {},
) {
  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  const queryClient =
    options.queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, retryDelay: 0 },
        mutations: { retry: false },
      },
    });
  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId',
        element: (
          <main>
            <ClassroomFamiliesPanel />
            <Toast />
          </main>
        ),
      },
    ],
    { initialEntries: [`/classrooms/${classroomId}`] },
  );

  return {
    queryClient,
    ...render(
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>,
      { queryClient },
    ),
  };
}

describe('ClassroomFamiliesPanel', () => {
  beforeAll(() => {
    mswServer.listen({ onUnhandledFrame: 'error' });
  });

  beforeEach(() => {
    vi.stubEnv('VITE_APP_ENV', 'test');
    vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  });

  afterEach(() => {
    mswServer.resetHandlers();
    vi.unstubAllEnvs();
  });

  afterAll(() => {
    mswServer.close();
  });

  test('lists active guardian links and unlinks with inline confirmation and focus restoration', async () => {
    const activeLink: ClassroomParentLinkPayload = {
      id: '6e5f6a7b-0000-4000-8000-000000000001',
      parentId: 'parent-1',
      parentDisplayName: 'Laura Gómez',
      childId: '4e5f6a7b-0000-4000-8000-000000000009',
      childDisplayName: 'Valentina Gómez',
      state: 'ACTIVE',
      createdAt: '2026-11-18T12:00:00.000Z',
    };
    const store = createClassroomInvitationsStore({
      classroomId,
      initialInvitations: [],
      initialParentLinks: [activeLink],
    });
    mswServer.use(
      createStaffDetailHandler({ adultMode: false }),
      ...store.handlers,
    );

    const { container } = renderFamiliesPanel();

    const parentLinksHeading = await screen.findByRole('heading', {
      name: copy.parentLinks.heading,
    });
    expect(parentLinksHeading).toBeVisible();
    expect(await screen.findByText('Laura Gómez')).toBeVisible();
    expect(
      screen.getByText(copy.parentLinks.linkedToLabel('Valentina Gómez')),
    ).toBeVisible();

    const unlinkTrigger = screen.getByRole('button', {
      name: copy.parentLinks.unlinkAriaLabel('Laura Gómez', 'Valentina Gómez'),
    });
    unlinkTrigger.focus();
    fireEvent.click(unlinkTrigger);

    const confirmHeading = await screen.findByRole('heading', {
      name: copy.parentLinks.confirmUnlinkTitle(
        'Laura Gómez',
        'Valentina Gómez',
      ),
    });
    expect(confirmHeading).toHaveFocus();
    await expectAccessible(container);

    // Cancel restores focus to trigger.
    fireEvent.click(
      screen.getByRole('button', {
        name: copy.parentLinks.confirmUnlinkCancel,
      }),
    );
    await waitFor(() => expect(unlinkTrigger).toHaveFocus());

    // Confirm unlinks guardian via DELETE and shows empty state.
    fireEvent.click(unlinkTrigger);
    fireEvent.click(
      await screen.findByRole('button', {
        name: copy.parentLinks.confirmUnlinkSubmit,
      }),
    );
    expect(await screen.findByText(copy.parentLinks.emptyTitle)).toBeVisible();
    expect(store.readParentLinks()[0]?.state).toBe('INACTIVE');
  });

  test('opens private messaging dialog for a linked guardian and sends a teacher reply', async () => {
    const activeLink: ClassroomParentLinkPayload = {
      id: '6e5f6a7b-0000-4000-8000-000000000002',
      parentId: '00000000-0000-4000-8000-000000000090',
      parentDisplayName: 'Laura Gómez',
      childId: '4e5f6a7b-0000-4000-8000-000000000009',
      childDisplayName: 'Valentina Gómez',
      state: 'ACTIVE',
      createdAt: '2026-11-18T12:00:00.000Z',
    };
    const threadMessages: ParentLinkMessagePayload[] = [
      {
        id: '88888888-8888-4888-8888-000000000001',
        parentLinkId: activeLink.id,
        authorId: activeLink.parentId,
        authorDisplayName: activeLink.parentDisplayName,
        authorRole: 'PARENT',
        body: 'Hola profe, ¿Valentina entregó el TP 2?',
        createdAt: '2026-11-24T14:00:00.000Z',
      },
    ];

    const store = createClassroomInvitationsStore({
      classroomId,
      initialInvitations: [],
      initialParentLinks: [activeLink],
    });
    mswServer.use(
      createStaffDetailHandler({ adultMode: false }),
      ...store.handlers,
      createParentLinkMessagesHandler({
        linkId: activeLink.id,
        items: () => threadMessages,
      }),
      createSendParentLinkMessageHandler({
        linkId: activeLink.id,
        authorId: profile.id,
        authorDisplayName: profile.displayName,
        authorRole: 'STAFF',
        onMessageCreated: (created) => {
          threadMessages.push(created);
        },
      }),
    );

    renderFamiliesPanel();

    const messagesButton = await screen.findByRole('button', {
      name: copy.parentLinks.messagesAriaLabel(
        activeLink.parentDisplayName,
        activeLink.childDisplayName,
      ),
    });
    fireEvent.click(messagesButton);

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', {
        name: copy.parentLinks.messagesDialogTitle(
          activeLink.parentDisplayName,
        ),
      }),
    ).toBeVisible();
    expect(
      within(dialog).getByText(
        copy.parentLinks.messagesDialogDescription(activeLink.childDisplayName),
      ),
    ).toBeVisible();
    expect(
      await within(dialog).findByText(
        'Hola profe, ¿Valentina entregó el TP 2?',
      ),
    ).toBeVisible();

    await expectAccessible(dialog);

    const textarea = within(dialog).getByLabelText(
      familyMessages.messaging.composer.label,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: 'Sí Laura, lo entregó ayer en fecha.' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: familyMessages.messaging.composer.submitAction,
      }),
    );

    expect(
      await within(dialog).findByText('Sí Laura, lo entregó ayer en fecha.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  test('renders an honest adultMode notice and hides messaging actions when adultMode is enabled', async () => {
    const store = createClassroomInvitationsStore({
      classroomId,
      adultMode: true,
      initialInvitations: [],
      initialParentLinks: [],
    });
    mswServer.use(
      createStaffDetailHandler({ adultMode: true }),
      ...store.handlers,
    );

    const { container } = renderFamiliesPanel();

    expect(
      await screen.findByText(copy.parentLinks.adultModeNote),
    ).toBeVisible();
    expect(
      screen.queryByText(copy.parentLinks.emptyTitle),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: copy.parentLinks.messagesAction }),
    ).not.toBeInTheDocument();

    await expectAccessible(container);
  });
});
