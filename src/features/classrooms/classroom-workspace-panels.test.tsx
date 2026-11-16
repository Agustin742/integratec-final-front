import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { expect, test } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { classroomDetailQueryKey } from '@/api/query-keys';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { render } from '@/test/render';
import { ClassroomWorkspace } from './classroom-workspace';
import { useClassroomPanels } from './panels/classroom-panels';

function SyntheticGrades() {
  return <input aria-label="Synthetic draft" defaultValue="" />;
}
const panels = [
  { key: 'grades', title: 'Synthetic grades', component: SyntheticGrades },
] as const;
function Consumer() {
  const { openPanel } = useClassroomPanels();
  return (
    <button onClick={(event) => openPanel('grades', event.currentTarget)}>
      Open grades
    </button>
  );
}
function setup(availablePanels: unknown = ['grades']) {
  let availability = availablePanels;
  let status = 200;
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async (input) => {
        const id = new URL((input as Request).url).pathname.split('/').pop();
        return status !== 200
          ? new Response(null, { status })
          : Response.json({
              id,
              name: `Classroom ${id}`,
              subject: null,
              schoolId: null,
              independentTeacherId: null,
              adultMode: false,
              chatMuted: false,
              collaborationLocked: false,
              gamesDisabled: false,
              deskCount: 0,
              pet: null,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              myRole: 'TEACHER',
              capabilities: [],
              availablePanels: availability,
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
        path: '/classrooms/:classroomId',
        element: <ClassroomWorkspace panels={panels} />,
        children: [{ index: true, Component: Consumer }],
      },
    ],
    { initialEntries: ['/classrooms/a'] },
  );
  render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );
  return {
    router,
    session,
    refresh: async (next: unknown, nextStatus = 200) => {
      availability = next;
      status = nextStatus;
      await act(() =>
        queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(profile.id, 'a'),
        }),
      );
    },
  };
}
async function open() {
  const trigger = await screen.findByRole('button', { name: 'Open grades' });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

test('workspace opens only server-available registered panels, without action capability inference', async () => {
  setup();
  const trigger = await open();
  expect(
    screen.getByRole('dialog', { name: 'Synthetic grades' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  await waitFor(() => expect(trigger).toHaveFocus());
});

test.each([undefined, null, [], ['settings'], 'grades', { includes: true }])(
  'workspace denies absent or malformed availability %j despite teacher role',
  async (availability) => {
    // Pass undefined through explicitly instead of using setup's default.
    const view = setup([]);
    await screen.findByRole('button', { name: 'Open grades' });
    await view.refresh(availability);
    const trigger = await open();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  },
);

test('observed availability loss closes the panel and clears its draft without reopening', async () => {
  const view = setup();
  await open();
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'private draft' },
  });
  await view.refresh([]);
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  await view.refresh(['grades']);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await open();
  expect(screen.getByRole('textbox')).toHaveValue('');
});

test.each([403, 404, 500])(
  'refresh failure %i removes the mounted panel host',
  async (status) => {
    const view = setup();
    await open();
    await view.refresh(['grades'], status);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('Classroom a')).not.toBeInTheDocument();
  },
);

test.each(['classroom', 'user'] as const)(
  'changing %s clears the active panel and its draft',
  async (scope) => {
    const view = setup();
    await open();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'private draft' },
    });
    if (scope === 'classroom')
      await act(() => view.router.navigate('/classrooms/b'));
    else
      act(() =>
        view.session.set({
          status: 'authenticated',
          user: { ...profile, id: 'other-user' },
        }),
      );
    await screen.findByRole('heading', {
      name: scope === 'classroom' ? 'Classroom b' : 'Classroom a',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await open();
    expect(screen.getByRole('textbox')).toHaveValue('');
  },
);
