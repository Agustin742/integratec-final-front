import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import type { components } from '@/api/schema.generated';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import { CLASSROOM_LAYOUT } from '@/realtime';
import {
  deriveClassroomInteractables,
  indexClassroomInteractables,
  type ClassroomInteractable,
} from '../world/classroom/classroom-interactables';
import { ClassroomWorkspace } from './classroom-workspace';
import { resetClassroomModeStore } from './classroom-mode-store';
import { classroomMessages } from './messages';

const worldMock = vi.hoisted(() => ({
  latestProps: null as null | {
    highlightedInteractableId?: string;
    ownDeskIndex?: number | null;
    petReactionNonce?: number;
    interactionLocked?: boolean;
    onHoverInteractable?: (id: string | undefined) => void;
    onSelectInteractable?: (interactable: ClassroomInteractable) => void;
  },
}));

vi.mock('../world', () => ({
  clearAssetCache: vi.fn(),
  PerformanceProbe: () => null,
  ClassroomWorld: (props: {
    label: string;
    scopeKey?: string;
    highlightedInteractableId?: string;
    ownDeskIndex?: number | null;
    petReactionNonce?: number;
    interactionLocked?: boolean;
    onHoverInteractable?: (id: string | undefined) => void;
    onSelectInteractable?: (interactable: ClassroomInteractable) => void;
    children?: ReactNode;
  }) => {
    worldMock.latestProps = props;
    return (
      <div role="region" aria-label={props.label}>
        <span data-testid="world-mock" />
        {props.children}
      </div>
    );
  },
}));

const interactablesById = indexClassroomInteractables(
  deriveClassroomInteractables(CLASSROOM_LAYOUT),
);

const syntheticPanels = [
  {
    key: 'activities',
    title: 'Actividades',
    component: () => <p>Contenido actividades</p>,
  },
  {
    key: 'material',
    title: 'Material',
    component: () => <p>Contenido material</p>,
  },
  { key: 'chat', title: 'Chat', component: () => <p>Contenido chat</p> },
  { key: 'notices', title: 'Avisos', component: () => <p>Contenido avisos</p> },
  { key: 'shop', title: 'Tienda', component: () => <p>Contenido tienda</p> },
  {
    key: 'bot',
    title: 'Asistente de estudio',
    component: () => <p>Contenido bot</p>,
  },
  {
    key: 'members',
    title: 'Integrantes',
    component: () => <p>Contenido integrantes</p>,
  },
  {
    key: 'grades',
    title: 'Calificaciones',
    component: () => <p>Contenido calificaciones</p>,
  },
  {
    key: 'settings',
    title: 'Configuración',
    component: () => <p>Contenido configuración</p>,
  },
] as const;

interface SetupOptions {
  readonly availablePanels?: components['schemas']['ClassroomPanelKey'][];
  readonly myRole?: components['schemas']['ClassroomContextResponseDto']['myRole'];
  readonly assignedDeskIndex?: number | null;
  readonly petName?: string | null;
  readonly shouldFailDesks?: () => boolean;
  readonly chatInbox?:
    | {
        readonly items: readonly {
          readonly classroomId: string;
          readonly classroomName: string;
          readonly lastMessage: null;
          readonly unreadCount: number;
        }[];
      }
    | 'error';
}

function setup(options: SetupOptions = {}) {
  const {
    availablePanels = [
      'activities',
      'material',
      'notices',
      'shop',
      'bot',
      'members',
      'grades',
    ],
    myRole = 'STUDENT',
    assignedDeskIndex = 2,
    petName = 'Michi',
    shouldFailDesks,
    chatInbox = {
      items: [
        {
          classroomId: 'aula-1',
          classroomName: 'Aula aula-1',
          lastMessage: null,
          unreadCount: 0,
        },
      ],
    },
  } = options;

  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async (input) => {
        const request = input as Request;
        const url = new URL(request.url);
        if (url.pathname.endsWith('/context-events')) {
          return new Response(new ReadableStream(), {
            headers: { 'content-type': 'text/event-stream' },
          });
        }
        if (url.pathname === '/chats') {
          if (chatInbox === 'error') {
            return new Response(
              JSON.stringify({
                error: {
                  code: 'UNAVAILABLE',
                  message: 'Unavailable',
                  correlationId: 'corr-chats-err',
                },
              }),
              { status: 503, headers: { 'content-type': 'application/json' } },
            );
          }
          return Response.json(chatInbox);
        }
        if (url.pathname.endsWith('/desks')) {
          if (shouldFailDesks?.()) {
            return new Response(
              JSON.stringify({
                error: {
                  code: 'UNAVAILABLE',
                  message: 'Unavailable',
                  correlationId: 'corr-desks-err',
                },
              }),
              { status: 503, headers: { 'content-type': 'application/json' } },
            );
          }
          return Response.json({
            items: Array.from({ length: 12 }, (_, idx) => {
              const deskIndex = idx + 1;
              const isMine =
                assignedDeskIndex !== null && deskIndex === assignedDeskIndex;
              return {
                id: `desk-${deskIndex}`,
                deskIndex,
                membershipId: isMine ? 'membership-mine' : null,
                userId: isMine
                  ? profile.id
                  : deskIndex === 5
                    ? 'other-student-id'
                    : null,
              };
            }),
          });
        }
        if (url.pathname.endsWith('/points')) {
          return Response.json({
            classroomId: 'aula-1',
            studentId: profile.id,
            balance: 100,
            items: [],
            page: 1,
            pageSize: 20,
            total: 0,
          });
        }
        const classroomId = url.pathname.split('/').pop() ?? 'aula-1';
        return Response.json({
          id: classroomId,
          name: `Aula ${classroomId}`,
          subject: null,
          schoolId: null,
          independentTeacherId: null,
          adultMode: false,
          chatMuted: false,
          collaborationLocked: false,
          gamesDisabled: false,
          myRole,
          capabilities: [],
          availablePanels,
          deskCount: 12,
          pet: petName
            ? {
                id: 'pet-1',
                name: petName,
                species: 'cat',
                level: 1,
                experience: 0,
              }
            : null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        });
      },
    }),
  );

  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <h2>Mis aulas</h2>,
      },
      {
        path: '/classrooms/:classroomId',
        element: <ClassroomWorkspace panels={syntheticPanels} />,
      },
    ],
    { initialEntries: ['/classrooms/aula-1'] },
  );

  const view = render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );

  return { ...view, router, queryClient, session };
}

beforeEach(() => {
  resetClassroomModeStore();
  worldMock.latestProps = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Classroom interactables HUD and 3D intent wiring (#38)', () => {
  test('opens a panel from 3D object selection, locks world interaction, and restores focus to stage heading on close', async () => {
    const { container } = setup();
    await screen.findByTestId('world-mock');
    await screen.findByRole('button', { name: 'Calificaciones' });

    const stageHeading = screen.getByRole('heading', {
      level: 3,
      name: classroomMessages.viewMode.stage3dHeading,
    });

    await expectAccessible(container);

    act(() => {
      worldMock.latestProps?.onHoverInteractable?.('board');
    });
    expect(worldMock.latestProps?.highlightedInteractableId).toBe('board');

    act(() => {
      worldMock.latestProps?.onSelectInteractable?.(
        interactablesById.get('board')!,
      );
    });

    const dialog = await screen.findByRole('dialog', { name: 'Actividades' });
    expect(dialog).toBeVisible();
    expect(worldMock.latestProps?.interactionLocked).toBe(true);
    expect(worldMock.latestProps?.highlightedInteractableId).toBeUndefined();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(stageHeading).toHaveFocus();
    expect(worldMock.latestProps?.interactionLocked).toBe(false);
  });

  test('highlights the 3D target when focusing a floating panel button and restores focus to that button on dialog close', async () => {
    setup();
    await screen.findByTestId('world-mock');

    const shopChip = screen.getByRole('button', { name: 'Tienda' });
    fireEvent.focus(shopChip);
    expect(worldMock.latestProps?.highlightedInteractableId).toBe('shop');
    expect(
      screen.queryByTestId('classroom-active-target'),
    ).not.toBeInTheDocument();

    shopChip.focus();
    fireEvent.click(shopChip);
    const dialog = await screen.findByRole('dialog', { name: 'Tienda' });
    expect(dialog).toBeVisible();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(shopChip).toHaveFocus();
  });

  test('hides unavailable panel buttons from the floating groups while 3D picking denies them honestly', async () => {
    setup({ availablePanels: ['activities'] });
    await screen.findByTestId('world-mock');

    const status = screen.getByTestId('classroom-interactable-status');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toBeEmptyDOMElement();

    expect(screen.getByRole('button', { name: 'Actividades' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Tienda' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Avisos' }),
    ).not.toBeInTheDocument();

    act(() => {
      worldMock.latestProps?.onSelectInteractable?.(
        interactablesById.get('bulletin-board')!,
      );
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(status).toHaveTextContent(
      classroomMessages.interactables.panelDenied,
    );
  });

  test('lets teachers without an assigned desk open grades from the floating button while refusing 3D student desk clicks', async () => {
    setup({
      myRole: 'TEACHER',
      assignedDeskIndex: null,
      availablePanels: ['activities', 'members', 'grades'],
    });
    await screen.findByTestId('world-mock');

    await waitFor(() => expect(worldMock.latestProps?.ownDeskIndex).toBeNull());
    expect(
      screen.getByRole('button', { name: 'Calificaciones' }),
    ).toBeVisible();

    act(() => {
      worldMock.latestProps?.onSelectInteractable?.(
        interactablesById.get('student-desk:1')!,
      );
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('classroom-interactable-status'),
    ).toHaveTextContent(classroomMessages.interactables.noAssignedDesk);

    fireEvent.click(screen.getByRole('button', { name: 'Calificaciones' }));
    expect(
      await screen.findByRole('dialog', { name: 'Calificaciones' }),
    ).toBeVisible();
  });

  test('offers a retry button when the desk map fails to load and recovers assigned desk on retry', async () => {
    let failDesks = true;
    setup({ assignedDeskIndex: 3, shouldFailDesks: () => failDesks });
    await screen.findByTestId('world-mock');

    const status = await screen.findByTestId('classroom-interactable-status');

    // Wait until the failed /desks query moves out of pending before picking.
    await waitFor(() => {
      act(() => {
        worldMock.latestProps?.onSelectInteractable?.(
          interactablesById.get('student-desk:3')!,
        );
      });
      expect(status).toHaveTextContent(
        classroomMessages.interactables.desksUnavailable,
      );
    });

    const retryBtn = within(status).getByRole('button', {
      name: classroomMessages.interactables.retryDesksAction,
    });
    failDesks = false;
    fireEvent.click(retryBtn);

    await waitFor(() => expect(worldMock.latestProps?.ownDeskIndex).toBe(3));
    await waitFor(() => expect(status).toBeEmptyDOMElement());
  });

  test('distinguishes own assigned desk from another student desk without leaking foreign data', async () => {
    setup({ assignedDeskIndex: 2 });
    await screen.findByTestId('world-mock');
    const ownChip = await screen.findByRole('button', {
      name: 'Calificaciones',
    });
    expect(worldMock.latestProps?.ownDeskIndex).toBe(2);

    // Selecting desk 5 (assigned to another user) never opens grades.
    act(() => {
      worldMock.latestProps?.onSelectInteractable?.(
        interactablesById.get('student-desk:5')!,
      );
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('classroom-interactable-status'),
    ).toHaveTextContent(classroomMessages.interactables.foreignDesk);
    expect(screen.queryByText(/other-student-id/i)).not.toBeInTheDocument();

    // Selecting own assigned desk opens grades.
    fireEvent.click(ownChip);
    expect(
      await screen.findByRole('dialog', { name: 'Calificaciones' }),
    ).toBeVisible();
  });

  test('keeps the decorative pet clickable in the world without a HUD button or hint strip', async () => {
    const { container } = setup({ petName: 'Michi' });
    await screen.findByTestId('world-mock');

    expect(
      screen.queryByRole('button', { name: 'Michi' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('classroom-active-target'),
    ).not.toBeInTheDocument();

    const initialNonce = worldMock.latestProps?.petReactionNonce ?? 0;
    act(() => {
      worldMock.latestProps?.onSelectInteractable?.(
        interactablesById.get('pet')!,
      );
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(worldMock.latestProps?.petReactionNonce).toBe(initialNonce + 1);
    expect(
      screen.getByTestId('classroom-interactable-status'),
    ).toHaveTextContent('Michi te saluda desde su rincón.');

    await expectAccessible(container);

    fireEvent.click(
      screen.getByRole('button', { name: 'Asistente de estudio' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Asistente de estudio' }),
    ).toBeVisible();
    expect(worldMock.latestProps?.petReactionNonce).toBe(initialNonce + 1);
  });

  test('keeps an empty live status region by default so nothing visible sits at the bottom', async () => {
    setup();
    await screen.findByTestId('world-mock');

    const status = screen.getByTestId('classroom-interactable-status');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toBeEmptyDOMElement();
    expect(status).toHaveClass('sr-only');
  });

  test('navigates cleanly to Mis aulas from the floating back link', async () => {
    const { router } = setup();
    await screen.findByTestId('world-mock');

    fireEvent.click(screen.getByRole('link', { name: 'Volver a mis aulas' }));
    expect(
      await screen.findByRole('heading', { name: 'Mis aulas' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('Immersive 3D classroom layout (#128)', () => {
  const allPanels: components['schemas']['ClassroomPanelKey'][] = [
    'activities',
    'material',
    'grades',
    'notices',
    'chat',
    'members',
    'bot',
    'shop',
  ];

  function buttonNames(group: HTMLElement) {
    return within(group)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent);
  }

  test('renders the work panels on the left and the community panels on the right, in order', async () => {
    setup({ availablePanels: allPanels });
    await screen.findByTestId('world-mock');

    const left = screen.getByRole('navigation', {
      name: classroomMessages.viewMode.immersive.workPanelsLabel,
    });
    const right = screen.getByRole('navigation', {
      name: classroomMessages.viewMode.immersive.communityPanelsLabel,
    });
    expect(buttonNames(left)).toEqual([
      'Actividades',
      'Material',
      'Calificaciones',
      'Avisos',
    ]);
    expect(buttonNames(right)).toEqual([
      'Integrantes',
      'Asistente de estudio',
      'Tienda',
    ]);
  });

  test('opens a panel from a floating button and restores focus to that button', async () => {
    setup({ availablePanels: allPanels });
    await screen.findByTestId('world-mock');

    const members = screen.getByRole('button', { name: 'Integrantes' });
    members.focus();
    fireEvent.click(members);
    const dialog = await screen.findByRole('dialog', { name: 'Integrantes' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(members).toHaveFocus();
  });

  test('hides panels the server did not make available instead of disabling them', async () => {
    setup({ availablePanels: ['activities', 'shop'] });
    await screen.findByTestId('world-mock');

    const left = screen.getByRole('navigation', {
      name: classroomMessages.viewMode.immersive.workPanelsLabel,
    });
    expect(buttonNames(left)).toEqual(['Actividades']);
  });

  test('offers Configuración last in the community group only when the server makes it available', async () => {
    const view = setup({ availablePanels: [...allPanels, 'settings'] });
    await screen.findByTestId('world-mock');

    const right = screen.getByRole('navigation', {
      name: classroomMessages.viewMode.immersive.communityPanelsLabel,
    });
    expect(buttonNames(right)).toEqual([
      'Integrantes',
      'Asistente de estudio',
      'Tienda',
      'Configuración',
    ]);
    view.unmount();

    setup({ availablePanels: allPanels });
    await screen.findByTestId('world-mock');
    expect(
      screen.queryByRole('button', { name: 'Configuración' }),
    ).not.toBeInTheDocument();
  });

  test('leaves chat to the global dock: no Chat button even when the server offers it', async () => {
    setup({ availablePanels: allPanels });
    await screen.findByTestId('world-mock');

    expect(
      screen.queryByRole('button', { name: 'Chat' }),
    ).not.toBeInTheDocument();
  });

  test('renders every panel button as a standalone card, not a flat item inside a grouped surface', async () => {
    setup({ availablePanels: allPanels });
    await screen.findByTestId('world-mock');

    for (const side of ['left', 'right']) {
      const group = screen.getByTestId(`classroom-3d-panels-${side}`);
      expect(group).not.toHaveClass('bg-card/85');
      expect(group).not.toHaveClass('border');
      expect(group.querySelector('ul')).toHaveClass('gap-3');
    }
    for (const name of ['Actividades', 'Material', 'Integrantes', 'Tienda']) {
      const button = screen.getByRole('button', { name });
      for (const cls of [
        'bg-card/85',
        'border',
        'border-edge',
        'rounded-2xl',
        'shadow-panel',
        'backdrop-blur-md',
      ]) {
        expect(button).toHaveClass(cls);
      }
    }
  });

  test('gives each floating panel button a touch-sized target', async () => {
    setup({ availablePanels: allPanels });
    await screen.findByTestId('world-mock');

    for (const name of ['Actividades', 'Tienda']) {
      expect(screen.getByRole('button', { name })).toHaveClass('min-h-11');
      expect(screen.getByRole('button', { name })).toHaveClass('min-w-11');
    }
  });

  test('floats the back link, name, role, wallet and mode toggle in a top bar over the world', async () => {
    setup();
    await screen.findByTestId('world-mock');

    const bar = screen.getByTestId('classroom-3d-top-bar');
    expect(
      within(bar).getByRole('link', { name: 'Volver a mis aulas' }),
    ).toBeVisible();
    expect(
      within(bar).getByRole('heading', { level: 2, name: 'Aula aula-1' }),
    ).toBeVisible();
    expect(within(bar).getByText(/Estudiante/)).toBeVisible();
    expect(
      await within(bar).findByRole('button', { name: /puntos/ }),
    ).toBeVisible();
    expect(
      within(bar).getByRole('button', {
        name: classroomMessages.viewMode.switchTo2d,
      }),
    ).toHaveAttribute('aria-keyshortcuts', 'Alt+M');
  });

  test('puts the profile icon link and a single notification bell at the right end of the top bar', async () => {
    setup();
    await screen.findByTestId('world-mock');

    const bar = screen.getByTestId('classroom-3d-top-bar');
    const profileLink = within(bar).getByRole('link', { name: 'Mi perfil' });
    expect(profileLink).toHaveAttribute('href', '/profile');
    expect(profileLink).toHaveClass('min-h-11', 'min-w-11');
    expect(
      await within(bar).findByRole('button', { name: /^Notificaciones/ }),
    ).toBeVisible();
    expect(
      screen.getAllByRole('button', { name: /^Notificaciones/ }),
    ).toHaveLength(1);
    expect(
      within(bar).queryByRole('button', { name: /reseña|Cerrar sesión/i }),
    ).not.toBeInTheDocument();
  });

  test('keeps Alt+M toggling and lands focus on the 3D heading when returning from 2D', async () => {
    setup();
    await screen.findByTestId('world-mock');

    fireEvent.keyDown(window, { key: 'm', code: 'KeyM', altKey: true });
    expect(
      await screen.findByRole('heading', {
        name: classroomMessages.viewMode.mode2dHeading,
      }),
    ).toHaveFocus();
    expect(
      screen.queryByTestId('classroom-3d-top-bar'),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'm', code: 'KeyM', altKey: true });
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: classroomMessages.viewMode.stage3dHeading,
      }),
    ).toHaveFocus();
  });

  test('renders no floating groups in 2D Classic Mode', async () => {
    setup({ availablePanels: allPanels });
    await screen.findByTestId('world-mock');

    fireEvent.click(
      screen.getByRole('button', {
        name: classroomMessages.viewMode.switchTo2d,
      }),
    );
    await screen.findByRole('heading', {
      name: classroomMessages.viewMode.mode2dHeading,
    });
    expect(
      screen.queryByRole('navigation', {
        name: classroomMessages.viewMode.immersive.workPanelsLabel,
      }),
    ).not.toBeInTheDocument();
    const nav2d = screen.getByRole('navigation', {
      name: classroomMessages.viewMode.mode2dNavLabel,
    });
    expect(nav2d).toBeVisible();
    await waitFor(() =>
      expect(
        within(nav2d).queryByRole('button', { name: /Chat/ }),
      ).not.toBeInTheDocument(),
    );
    expect(within(nav2d).getByRole('button', { name: /Tienda/ })).toBeVisible();
  });

  test.each([
    ['fails', 'error' as const],
    ['omits the classroom', { items: [] }],
  ])(
    'shows Chat in 2D Classic Mode fallback when the live chat inbox %s',
    async (_label, chatInbox) => {
      setup({ availablePanels: allPanels, chatInbox });
      await screen.findByTestId('world-mock');

      fireEvent.click(
        screen.getByRole('button', {
          name: classroomMessages.viewMode.switchTo2d,
        }),
      );
      const nav2d = await screen.findByRole('navigation', {
        name: classroomMessages.viewMode.mode2dNavLabel,
      });
      expect(
        await within(nav2d).findByRole('button', { name: 'Chat' }),
      ).toBeVisible();
    },
  );

  test('keeps the world visible behind panels in 3D only, with a translucent overlay', async () => {
    setup({ availablePanels: allPanels });
    await screen.findByTestId('world-mock');

    fireEvent.click(screen.getByRole('button', { name: 'Tienda' }));
    await screen.findByRole('dialog', { name: 'Tienda' });
    const overlay3d = document.querySelector('[data-state="open"].inset-0');
    expect(overlay3d).toHaveClass('backdrop-blur-xs');
    expect(overlay3d).not.toHaveClass('bg-foreground/45');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: classroomMessages.viewMode.switchTo2d,
      }),
    );
    const nav = await screen.findByRole('navigation', {
      name: classroomMessages.viewMode.mode2dNavLabel,
    });
    fireEvent.click(within(nav).getByRole('button', { name: /Tienda/ }));
    await screen.findByRole('dialog', { name: 'Tienda' });
    const overlay2d = document.querySelector('[data-state="open"].inset-0');
    expect(overlay2d).toHaveClass('bg-foreground/45');
    expect(overlay2d).not.toHaveClass('backdrop-blur-xs');
  });

  test('locks page scrolling while the immersive world is shown and releases it in 2D and on unmount', async () => {
    const { unmount } = setup();
    await screen.findByTestId('world-mock');
    expect(document.documentElement.style.overflow).toBe('hidden');

    fireEvent.click(
      screen.getByRole('button', {
        name: classroomMessages.viewMode.switchTo2d,
      }),
    );
    await screen.findByRole('heading', {
      name: classroomMessages.viewMode.mode2dHeading,
    });
    expect(document.documentElement.style.overflow).toBe('');

    fireEvent.click(
      screen.getByRole('button', {
        name: classroomMessages.viewMode.switchTo3d,
      }),
    );
    await screen.findByTestId('world-mock');
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
  });
});

describe('Pet greeting auto-dismiss (#128)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function pickPet() {
    act(() => {
      worldMock.latestProps?.onSelectInteractable?.(
        interactablesById.get('pet')!,
      );
    });
  }

  test('dismisses the greeting after a few seconds', async () => {
    setup({ petName: 'Michi' });
    await screen.findByTestId('world-mock');
    const status = screen.getByTestId('classroom-interactable-status');

    vi.useFakeTimers();
    pickPet();
    expect(status).toHaveTextContent('Michi te saluda desde su rincón.');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(status).toHaveTextContent('Michi te saluda');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(status).toBeEmptyDOMElement();
  });

  test('restarts the timer when the pet is greeted again', async () => {
    setup({ petName: 'Michi' });
    await screen.findByTestId('world-mock');
    const status = screen.getByTestId('classroom-interactable-status');

    vi.useFakeTimers();
    pickPet();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    pickPet();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(status).toHaveTextContent('Michi te saluda');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(status).toBeEmptyDOMElement();
  });

  test('clears the greeting as soon as another panel is opened', async () => {
    setup({ petName: 'Michi' });
    await screen.findByTestId('world-mock');
    const status = screen.getByTestId('classroom-interactable-status');

    pickPet();
    expect(status).toHaveTextContent('Michi te saluda');
    fireEvent.click(screen.getByRole('button', { name: 'Tienda' }));
    expect(status).toBeEmptyDOMElement();
  });

  test('never auto-dismisses error feedback that offers a retry', async () => {
    setup({ assignedDeskIndex: 3, shouldFailDesks: () => true });
    await screen.findByTestId('world-mock');
    const status = screen.getByTestId('classroom-interactable-status');

    await waitFor(() => {
      act(() => {
        worldMock.latestProps?.onSelectInteractable?.(
          interactablesById.get('student-desk:3')!,
        );
      });
      expect(status).toHaveTextContent(
        classroomMessages.interactables.desksUnavailable,
      );
    });

    vi.useFakeTimers();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(status).toHaveTextContent(
      classroomMessages.interactables.desksUnavailable,
    );
    expect(
      within(status).getByRole('button', {
        name: classroomMessages.interactables.retryDesksAction,
      }),
    ).toBeVisible();
  });

  test('leaves no pending dismissal behind when the stage unmounts', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = setup({ petName: 'Michi' });
    await screen.findByTestId('world-mock');

    vi.useFakeTimers();
    pickPet();
    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
