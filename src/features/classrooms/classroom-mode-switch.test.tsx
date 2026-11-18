import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createMemoryRouter, useOutletContext } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import type { components } from '@/api/schema.generated';
import { createAppRoutes } from '@/app/router/routes';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import {
  getClassroomMode,
  resetClassroomModeStore,
} from './classroom-mode-store';
import { ClassroomWorkspace } from './classroom-workspace';
import { classroomMessages } from './messages';

type Detail = components['schemas']['ClassroomContextResponseDto'];

function buildDetail(id: string, overrides: Partial<Detail> = {}): Detail {
  return {
    id,
    name: `Aula ${id}`,
    subject: null,
    schoolId: null,
    independentTeacherId: null,
    adultMode: true,
    chatMuted: true,
    collaborationLocked: false,
    gamesDisabled: false,
    myRole: 'STUDENT',
    capabilities: ['view_metrics', 'participate_activities'],
    availablePanels: ['activities', 'grades'],
    deskCount: 1,
    pet: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function ContextOutletProbe() {
  const context = useOutletContext<Detail>();
  return (
    <div>
      <output data-testid="workspace-outlet">{`${context.id}:${context.myRole}:${String(context.adultMode)}`}</output>
      <label htmlFor="probe-draft">Borrador</label>
      <input id="probe-draft" type="text" defaultValue="" />
      <label htmlFor="probe-notes">Notas</label>
      <textarea id="probe-notes" defaultValue="" />
      <label htmlFor="probe-filter">Filtro</label>
      <select id="probe-filter" defaultValue="all">
        <option value="all">Todos</option>
      </select>
      <div
        data-testid="probe-editable"
        contentEditable
        suppressContentEditableWarning
      >
        Editable
      </div>
    </div>
  );
}

function setupWorkspace(
  options: {
    readonly userId?: string;
    readonly path?: string;
    readonly detailOverrides?: Partial<Detail>;
  } = {},
) {
  const user = { ...profile, id: options.userId ?? profile.id };
  const session = fakeSession(
    { status: 'authenticated', user },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async (input) => {
        const request = input as Request;
        if (request.url.endsWith('/context-events')) {
          return new Response(new ReadableStream(), {
            headers: { 'content-type': 'text/event-stream' },
          });
        }
        const id = new URL(request.url).pathname.split('/').pop() ?? 'a';
        return Response.json(buildDetail(id, options.detailOverrides));
      },
    }),
  );
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Collect owner cleanups so a test can replay the controller's logout release.
  const cleanups = new Set<() => void>();
  session.service.controller.registerCleanup = (cleanup) => {
    cleanups.add(cleanup);
    return () => cleanups.delete(cleanup);
  };
  const runSessionCleanups = () =>
    act(() => cleanups.forEach((cleanup) => cleanup()));
  const router = createMemoryRouter(
    createAppRoutes({
      protectedRoutes: [
        {
          path: 'test-classrooms/:classroomId',
          Component: ClassroomWorkspace,
          children: [{ index: true, Component: ContextOutletProbe }],
        },
      ],
    }),
    { initialEntries: [options.path ?? '/classrooms/a'] },
  );

  const view = render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );

  return { ...view, session, queryClient, router, runSessionCleanups };
}

describe('ClassroomWorkspace 3D / 2D Classic Mode switch (#34)', () => {
  beforeEach(() => {
    resetClassroomModeStore();
  });

  test('S1: switches between 3D view and 2D Classic Mode via button and Alt+M without losing context or leaving a canvas', async () => {
    const { container } = setupWorkspace({ path: '/test-classrooms/a' });

    const classroomHeading = await screen.findByRole('heading', {
      level: 2,
      name: 'Aula a',
    });
    expect(classroomHeading).toBeVisible();
    expect(screen.getByTestId('workspace-outlet')).toHaveTextContent(
      'a:STUDENT:true',
    );

    // Initial state defaults to 3D with canvas mounted and no 2D panel nav.
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: classroomMessages.viewMode.stage3dHeading,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', {
        name: classroomMessages.viewMode.canvasLabel,
      }),
    ).toBeVisible();
    expect(container.querySelector('canvas')).not.toBeNull();
    expect(
      screen.queryByRole('navigation', {
        name: classroomMessages.viewMode.mode2dNavLabel,
      }),
    ).not.toBeInTheDocument();

    await expectAccessible(container);

    // Toggle to 2D Classic Mode via the header button.
    const to2dButton = screen.getByRole('button', {
      name: classroomMessages.viewMode.switchTo2d,
    });
    expect(to2dButton).toHaveAttribute('aria-keyshortcuts', 'Alt+M');
    fireEvent.click(to2dButton);

    const heading2d = await screen.findByRole('heading', {
      level: 3,
      name: classroomMessages.viewMode.mode2dHeading,
    });
    expect(heading2d).toBeVisible();
    expect(heading2d).toHaveAttribute('tabindex', '-1');
    expect(heading2d).toHaveFocus();
    expect(container.querySelector('canvas')).toBeNull();
    expect(screen.getByTestId('workspace-outlet')).toHaveTextContent(
      'a:STUDENT:true',
    );
    expect(
      screen.getByRole('button', {
        name: classroomMessages.viewMode.switchTo3d,
      }),
    ).toBeVisible();

    await expectAccessible(container);

    // Toggle back to 3D via Alt+M shortcut and confirm focus moves to 3D heading.
    fireEvent.keyDown(document.body, { key: 'm', code: 'KeyM', altKey: true });

    const heading3d = await screen.findByRole('heading', {
      level: 3,
      name: classroomMessages.viewMode.stage3dHeading,
    });
    expect(heading3d).toBeVisible();
    expect(heading3d).toHaveAttribute('tabindex', '-1');
    expect(heading3d).toHaveFocus();
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  test('ignores Alt+M when modifier combinations differ, repeat fires, text controls have focus, or a dialog is open', async () => {
    setupWorkspace({ path: '/test-classrooms/a' });

    await screen.findByRole('heading', { level: 2, name: 'Aula a' });

    // Ignore Ctrl+Alt+M and repeated keydown events.
    fireEvent.keyDown(document.body, {
      key: 'm',
      code: 'KeyM',
      altKey: true,
      ctrlKey: true,
    });
    fireEvent.keyDown(document.body, {
      key: 'm',
      code: 'KeyM',
      altKey: true,
      repeat: true,
    });
    expect(
      screen.queryByRole('heading', {
        level: 3,
        name: classroomMessages.viewMode.mode2dHeading,
      }),
    ).not.toBeInTheDocument();

    // Ignore Alt+M inside input, textarea, select, and contentEditable.
    for (const control of [
      screen.getByLabelText('Borrador'),
      screen.getByLabelText('Notas'),
      screen.getByLabelText('Filtro'),
      screen.getByTestId('probe-editable'),
    ]) {
      control.focus();
      fireEvent.keyDown(control, { key: 'm', code: 'KeyM', altKey: true });
      expect(
        screen.queryByRole('heading', {
          level: 3,
          name: classroomMessages.viewMode.mode2dHeading,
        }),
      ).not.toBeInTheDocument();
    }

    // Switch cleanly with Alt+M from workspace button, open a panel dialog, and verify Alt+M does not switch under modal dialog.
    fireEvent.keyDown(document.body, { key: 'm', code: 'KeyM', altKey: true });
    const nav = await screen.findByRole('navigation', {
      name: classroomMessages.viewMode.mode2dNavLabel,
    });
    fireEvent.click(within(nav).getByRole('button', { name: /Actividades/ }));
    const dialog = await screen.findByRole('dialog', {
      name: classroomMessages.panels.activities,
    });
    fireEvent.keyDown(dialog, { key: 'm', code: 'KeyM', altKey: true });
    // Radix hides background controls while modal; confirm mode stays 2D after closing.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: classroomMessages.viewMode.mode2dHeading,
      }),
    ).toBeInTheDocument();
  });

  test('S2: exposes only server-available catalog panels in 2D mode, opens dialogs by keyboard/click with focus restore, and renders empty state', async () => {
    setupWorkspace({
      path: '/classrooms/a',
      detailOverrides: {
        myRole: 'TEACHER',
        availablePanels: ['activities', 'grades', 'pet'],
      },
    });

    await screen.findByRole('heading', { level: 2, name: 'Aula a' });
    fireEvent.click(
      screen.getByRole('button', {
        name: classroomMessages.viewMode.switchTo2d,
      }),
    );

    const nav = await screen.findByRole('navigation', {
      name: classroomMessages.viewMode.mode2dNavLabel,
    });
    const activitiesBtn = within(nav).getByRole('button', {
      name: /Actividades/,
    });
    const gradesBtn = within(nav).getByRole('button', {
      name: /Calificaciones/,
    });
    expect(activitiesBtn).toBeVisible();
    expect(gradesBtn).toBeVisible();
    // Reserved pet and non-available panels must never appear.
    expect(
      within(nav).queryByRole('button', { name: /Configuración/ }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole('button', { name: /Material/ }),
    ).not.toBeInTheDocument();
    expect(nav).not.toHaveTextContent(/pet/i);

    gradesBtn.focus();
    fireEvent.click(gradesBtn);
    const dialog = await screen.findByRole('dialog', {
      name: classroomMessages.panels.grades,
    });
    expect(dialog).toHaveTextContent(classroomMessages.pendingPanelTitle);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(gradesBtn).toHaveFocus();
  });

  test('S2: shows honest empty state in 2D mode when server returns no availablePanels', async () => {
    setupWorkspace({
      path: '/classrooms/a',
      detailOverrides: { availablePanels: [] },
    });

    await screen.findByRole('heading', { level: 2, name: 'Aula a' });
    fireEvent.click(
      screen.getByRole('button', {
        name: classroomMessages.viewMode.switchTo2d,
      }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 4,
        name: classroomMessages.viewMode.mode2dEmptyTitle,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('navigation', {
        name: classroomMessages.viewMode.mode2dNavLabel,
      }),
    ).not.toBeInTheDocument();
  });

  test('S3: keeps 2D mode across classroom navigation for the same user, and resets to 3D on account switch and logout', async () => {
    const { router, session } = setupWorkspace({ path: '/classrooms/a' });

    await screen.findByRole('heading', { level: 2, name: 'Aula a' });
    fireEvent.click(
      screen.getByRole('button', {
        name: classroomMessages.viewMode.switchTo2d,
      }),
    );
    await screen.findByRole('heading', {
      level: 3,
      name: classroomMessages.viewMode.mode2dHeading,
    });

    // Switching classrooms within the same account keeps 2D preference.
    await act(() => router.navigate('/classrooms/b'));
    await screen.findByRole('heading', { level: 2, name: 'Aula b' });
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: classroomMessages.viewMode.mode2dHeading,
      }),
    ).toBeVisible();

    // Switching accounts drops the previous user's preference and starts user-2 in 3D.
    act(() => {
      session.set({
        status: 'authenticated',
        user: { ...profile, id: 'user-2' },
      });
    });
    await screen.findByRole('heading', { level: 2, name: 'Aula b' });
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: classroomMessages.viewMode.stage3dHeading,
      }),
    ).toBeVisible();

    // Toggle user-2 to 2D, trigger logout cleanup, then log in as user-1 -> starts fresh in 3D.
    fireEvent.click(
      screen.getByRole('button', {
        name: classroomMessages.viewMode.switchTo2d,
      }),
    );
    await screen.findByRole('heading', {
      level: 3,
      name: classroomMessages.viewMode.mode2dHeading,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    await session.service.controller.logout();

    act(() => {
      session.set({
        status: 'authenticated',
        user: { ...profile, id: profile.id },
      });
    });
    await act(() => router.navigate('/classrooms/a'));
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: classroomMessages.viewMode.stage3dHeading,
      }),
    ).toBeVisible();
  });

  test('S3: logout from a non-classroom route still clears the same user preference', async () => {
    const { router, runSessionCleanups } = setupWorkspace({
      path: '/classrooms/a',
    });

    await screen.findByRole('heading', { level: 2, name: 'Aula a' });
    fireEvent.click(
      screen.getByRole('button', {
        name: classroomMessages.viewMode.switchTo2d,
      }),
    );
    await screen.findByRole('heading', {
      level: 3,
      name: classroomMessages.viewMode.mode2dHeading,
    });

    // Leave the workspace so only the app shell owns the cleanup.
    await act(() => router.navigate('/'));
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { level: 2, name: 'Aula a' }),
      ).not.toBeInTheDocument(),
    );
    expect(getClassroomMode(profile.id)).toBe('2d');

    // Replays what the session controller runs on logout.
    runSessionCleanups();

    expect(getClassroomMode(profile.id)).toBe('3d');
  });

  test('never offers 3D stage, 2D classroom panels, or mode switch to PARENT accounts', async () => {
    const { container } = setupWorkspace({
      path: '/classrooms/a',
      detailOverrides: {
        myRole: 'PARENT',
        capabilities: ['message_teacher'],
        availablePanels: ['grades', 'notices'],
      },
    });

    await screen.findByRole('heading', { level: 2, name: 'Aula a' });
    expect(container.querySelector('canvas')).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: classroomMessages.viewMode.switchTo2d,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', {
        name: classroomMessages.viewMode.mode2dNavLabel,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        level: 3,
        name: classroomMessages.viewMode.stage3dHeading,
      }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'm', code: 'KeyM', altKey: true });
    expect(
      screen.queryByRole('heading', {
        level: 3,
        name: classroomMessages.viewMode.mode2dHeading,
      }),
    ).not.toBeInTheDocument();
  });
});
