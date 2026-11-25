import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import type { components } from '@/api/schema.generated';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import {
  TEST_API_BASE_URL,
  createClassroomDetailHandler,
  type ClassroomMaterialItem,
  type ClassroomMaterialModuleItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { MaterialPanel, type MaterialPanelProps } from './material-panel';

export const CLASSROOM_ID = '00000000-0000-4000-8000-000000000010';
export const MATERIAL_ID = '00000000-0000-4000-8000-000000001001';

type Capability =
  components['schemas']['ClassroomContextResponseDto']['capabilities'][number];

export function renderMaterialPanel(options: {
  readonly role?: 'TEACHER' | 'STUDENT';
  readonly capabilities?: readonly Capability[];
  readonly panelProps?: MaterialPanelProps;
}) {
  const role = options.role ?? 'TEACHER';
  const capabilities: Capability[] =
    options.capabilities !== undefined
      ? [...options.capabilities]
      : role === 'TEACHER'
        ? ['publish_content', 'configure_classroom']
        : ['participate_activities'];

  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_ID, {
      myRole: role,
      capabilities,
    }),
  );

  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  const queryClient = createAppQueryClient();
  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId',
        element: <MaterialPanel {...options.panelProps} />,
      },
    ],
    { initialEntries: [`/classrooms/${CLASSROOM_ID}`] },
  );

  return {
    ...render(
      <ApiQueryProvider client={queryClient}>
        <SessionProvider service={session.service}>
          <RouterProvider router={router} />
        </SessionProvider>
      </ApiQueryProvider>,
    ),
    queryClient,
  };
}

export const MODULE_1 = '00000000-0000-4000-8000-000000002001';
export const MODULE_2 = '00000000-0000-4000-8000-000000002002';
export const MODULE_3 = '00000000-0000-4000-8000-000000002003';

export function moduleFixture(
  id: string,
  name: string,
  position: number,
  description: string | null = null,
): ClassroomMaterialModuleItem {
  return {
    id,
    classroomId: CLASSROOM_ID,
    name,
    description,
    position,
    createdAt: '2026-11-18T03:00:00.000Z',
    updatedAt: '2026-11-18T03:00:00.000Z',
  };
}

export const THREE_MODULES: readonly ClassroomMaterialModuleItem[] = [
  moduleFixture(MODULE_1, 'Unidad 1', 0, 'Funciones y gráficos'),
  moduleFixture(MODULE_2, 'Unidad 2', 1),
  moduleFixture(MODULE_3, 'Unidad 3', 2, 'Geometría'),
];

export function materialFixture(
  id: string,
  filename: string,
  moduleId: string | null,
  createdAt = '2026-11-18T03:00:00.000Z',
): ClassroomMaterialItem {
  return {
    id,
    classroomId: CLASSROOM_ID,
    authorId: profile.id,
    filename,
    contentType: 'application/pdf',
    sizeBytes: 2048,
    moduleId,
    createdAt,
  };
}
