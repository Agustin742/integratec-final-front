import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import { createAppQueryClient } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createClassroomContextHandler,
  createClassroomRosterStore,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ClassroomMembersPanel } from './classroom-members-panel';
import { classroomMessages } from './messages';

vi.setConfig({ testTimeout: 20_000 });

const CLASSROOM_ID = '00000000-0000-4000-8000-0000000000a1';
const copy = classroomMessages.members;

const directory = [
  {
    id: profile.id,
    userId: profile.id,
    displayName: 'Lucas Alumno',
    role: 'STUDENT',
  },
  {
    id: 'u-teacher',
    userId: 'u-teacher',
    displayName: 'Carlos Pérez',
    role: 'TEACHER',
  },
  {
    id: 'u-student-2',
    userId: 'u-student-2',
    displayName: 'Marta Gómez',
    role: 'STUDENT',
  },
];

function directoryHandler(onRequest?: () => void) {
  return http.get(`${TEST_API_BASE_URL}/classrooms/:id/members`, () => {
    onRequest?.();
    return HttpResponse.json({
      items: directory,
      page: 1,
      pageSize: 100,
      total: directory.length,
    });
  });
}

function renderMembers() {
  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId',
        element: (
          <main>
            <ClassroomMembersPanel />
          </main>
        ),
      },
    ],
    { initialEntries: [`/classrooms/${CLASSROOM_ID}`] },
  );
  return render(
    <SessionProvider service={session.service}>
      <RouterProvider router={router} />
    </SessionProvider>,
    { queryClient },
  );
}

describe('ClassroomMembersPanel', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  test('students see a directory grouped into teachers and students with counts, without roster requests', async () => {
    let rosterRequests = 0;
    mswServer.use(
      createClassroomContextHandler(CLASSROOM_ID, { myRole: 'STUDENT' }),
      directoryHandler(),
      http.get(`${TEST_API_BASE_URL}/classrooms/:id/roster`, () => {
        rosterRequests += 1;
        return HttpResponse.json({}, { status: 403 });
      }),
    );
    const { container } = renderMembers();

    const teachers = await screen.findByRole('region', {
      name: new RegExp(`^${copy.teachersHeading}`),
    });
    expect(within(teachers).getByText('Carlos Pérez')).toBeVisible();
    expect(within(teachers).getByText('1')).toBeVisible();
    expect(within(teachers).getByText('CP')).toBeInTheDocument();

    const students = screen.getByRole('region', {
      name: new RegExp(`^${copy.studentsHeading}`),
    });
    expect(within(students).getByText('Marta Gómez')).toBeVisible();
    expect(within(students).getByText('Lucas Alumno')).toBeVisible();
    expect(within(students).getByText('2')).toBeVisible();
    // The caller is marked.
    expect(within(students).getByText(copy.selfBadge)).toBeVisible();
    expect(rosterRequests).toBe(0);
    await expectAccessible(container);
  });

  test('students get an intentional error state with retry when the directory fails', async () => {
    let calls = 0;
    mswServer.use(
      createClassroomContextHandler(CLASSROOM_ID, { myRole: 'STUDENT' }),
      http.get(`${TEST_API_BASE_URL}/classrooms/:id/members`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { code: 'INTERNAL', message: 'x', correlationId: 'c' },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          items: directory,
          page: 1,
          pageSize: 100,
          total: 3,
        });
      }),
    );
    renderMembers();

    expect(await screen.findByText(copy.directoryErrorTitle)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: copy.directoryRetry }));
    expect(await screen.findByText('Marta Gómez')).toBeVisible();
  });

  test('staff see the teaching team above the managed student roster', async () => {
    const store = createClassroomRosterStore({
      classroomId: CLASSROOM_ID,
      initialStudents: [
        {
          membershipId: 'm-1',
          userId: 'u-student-2',
          displayName: 'Marta Gómez',
          state: 'ACTIVE',
          deletedAt: null,
          guardians: [],
        },
      ],
    });
    mswServer.use(
      createClassroomContextHandler(CLASSROOM_ID, {
        myRole: 'TEACHER',
        capabilities: ['publish_content', 'invite_members', 'list_directory'],
      }),
      directoryHandler(),
      ...store.handlers,
    );
    renderMembers();

    const teachers = await screen.findByRole('region', {
      name: new RegExp(`^${copy.teachersHeading}`),
    });
    expect(within(teachers).getByText('Carlos Pérez')).toBeVisible();
    expect(
      await screen.findByText(classroomMessages.roster.studentCount(1)),
    ).toBeVisible();
    await waitFor(() => expect(screen.getByText('Marta Gómez')).toBeVisible());
    expect(
      screen.getByRole('tab', { name: copy.invitationsTab }),
    ).toBeVisible();
  });

  test('loads all directory pages when classroom has over 100 members', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({
      id: `id-${i + 1}`,
      userId: `u-student-${i + 1}`,
      displayName: `Estudiante ${i + 1}`,
      role: 'STUDENT' as const,
    }));
    const secondPage = [
      {
        id: 'id-101',
        userId: 'u-teacher-page2',
        displayName: 'Docente Página Dos',
        role: 'TEACHER' as const,
      },
      {
        id: 'id-102',
        userId: 'u-student-101',
        displayName: 'Estudiante Ciento Uno',
        role: 'STUDENT' as const,
      },
    ];
    mswServer.use(
      createClassroomContextHandler(CLASSROOM_ID, { myRole: 'STUDENT' }),
      http.get(`${TEST_API_BASE_URL}/classrooms/:id/members`, ({ request }) => {
        const page = Number(
          new URL(request.url).searchParams.get('page') ?? '1',
        );
        return HttpResponse.json({
          items: page === 1 ? firstPage : secondPage,
          page,
          pageSize: 100,
          total: 102,
        });
      }),
    );

    renderMembers();

    const teachersRegion = await screen.findByRole('region', {
      name: new RegExp(`^${copy.teachersHeading}`),
    });
    expect(
      within(teachersRegion).getByText('Docente Página Dos'),
    ).toBeVisible();
    const studentsRegion = screen.getByRole('region', {
      name: new RegExp(`^${copy.studentsHeading}`),
    });
    expect(
      within(studentsRegion).getByText('Estudiante Ciento Uno'),
    ).toBeVisible();
    expect(studentsRegion.querySelectorAll('li')).toHaveLength(101);
  });
});
