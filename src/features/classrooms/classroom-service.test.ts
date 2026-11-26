import { HttpResponse, http } from 'msw';
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
import { ApiError } from '@/api/errors';
import {
  TEST_API_BASE_URL,
  createClassroomListHandler,
  createCreateClassroomHandler,
  createUpdateClassroomHandler,
  type ClassroomDetailPayload,
  type ClassroomListItemPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import {
  CLASSROOM_NAME_MAX_LENGTH,
  CLASSROOM_SUBJECT_MAX_LENGTH,
  classroomFormSchema,
  toCreateClassroomPayload,
  toUpdateClassroomPayload,
} from './classroom-schema';
import {
  createClassroom,
  isUncertainWriteError,
  listAccessibleClassrooms,
  updateClassroom,
} from './classroom-service';
import { classroomMessages } from './messages';

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  mswServer.resetHandlers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

const teacherCapabilities: ClassroomListItemPayload['capabilities'] = [
  'configure_classroom',
  'invite_members',
  'publish_content',
  'moderate_chat',
  'configure_bot',
  'view_metrics',
  'chat_classmates',
  'list_directory',
  'message_teacher',
];

const validListItem: ClassroomListItemPayload = {
  id: '4e5f6a7b-0000-4000-8000-000000000001',
  name: '3.º Año B - Matemática',
  subject: 'Matemática y Geometría',
  schoolId: '3f6c2d9e-0000-4000-8000-000000000000',
  independentTeacherId: null,
  adultMode: false,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  tutorBotSkin: 'none',
  myRole: 'TEACHER',
  capabilities: teacherCapabilities,
  createdAt: '2026-11-17T20:00:00.000Z',
  updatedAt: '2026-11-17T20:00:00.000Z',
};

const validDetail: ClassroomDetailPayload = {
  ...validListItem,
  deskCount: 12,
  pet: {
    id: '9a1b2c3d-0000-4000-8000-000000000001',
    name: 'Michi',
    species: 'cat',
    level: 1,
    experience: 0,
  },
};

describe('classroomFormSchema', () => {
  test('validates visible text boundaries, max lengths, and optional fields', () => {
    const validMax = classroomFormSchema.safeParse({
      name: `  ${'A'.repeat(CLASSROOM_NAME_MAX_LENGTH)}  `,
      subject: ' '.repeat(3) + 'B'.repeat(CLASSROOM_SUBJECT_MAX_LENGTH),
      adultMode: true,
      schoolId: '  3f6c2d9e-0000-4000-8000-000000000000  ',
    });
    expect(validMax.success).toBe(true);
    if (validMax.success) {
      expect(validMax.data.name).toBe('A'.repeat(CLASSROOM_NAME_MAX_LENGTH));
      expect(validMax.data.subject).toBe(
        'B'.repeat(CLASSROOM_SUBJECT_MAX_LENGTH),
      );
      expect(validMax.data.schoolId).toBe(
        '3f6c2d9e-0000-4000-8000-000000000000',
      );
    }

    const validBlankSubject = classroomFormSchema.safeParse({
      name: 'Historia Contemporánea',
      subject: '   ',
      adultMode: false,
      schoolId: '',
    });
    expect(validBlankSubject.success).toBe(true);
  });

  test('rejects empty, overlong, control-character, and invisible-only inputs', () => {
    const emptyName = classroomFormSchema.safeParse({
      name: '   ',
      subject: '',
      adultMode: false,
      schoolId: '',
    });
    expect(emptyName.success).toBe(false);

    const controlName = classroomFormSchema.safeParse({
      name: 'Matemática\n3°B',
      subject: '',
      adultMode: false,
      schoolId: '',
    });
    expect(controlName.success).toBe(false);

    const invisibleName = classroomFormSchema.safeParse({
      name: '\u200B\u2800',
      subject: '',
      adultMode: false,
      schoolId: '',
    });
    expect(invisibleName.success).toBe(false);

    const overlongName = classroomFormSchema.safeParse({
      name: 'X'.repeat(CLASSROOM_NAME_MAX_LENGTH + 1),
      subject: '',
      adultMode: false,
      schoolId: '',
    });
    expect(overlongName.success).toBe(false);

    const controlSubject = classroomFormSchema.safeParse({
      name: 'Lengua',
      subject: 'Literatura\tGeneral',
      adultMode: false,
      schoolId: '',
    });
    expect(controlSubject.success).toBe(false);

    const invisibleSubject = classroomFormSchema.safeParse({
      name: 'Lengua',
      subject: '\u200B',
      adultMode: false,
      schoolId: '',
    });
    expect(invisibleSubject.success).toBe(false);

    const overlongSubject = classroomFormSchema.safeParse({
      name: 'Lengua',
      subject: 'Y'.repeat(CLASSROOM_SUBJECT_MAX_LENGTH + 1),
      adultMode: false,
      schoolId: '',
    });
    expect(overlongSubject.success).toBe(false);

    const invalidSchool = classroomFormSchema.safeParse({
      name: 'Lengua',
      subject: '',
      adultMode: false,
      schoolId: 'not-a-uuid',
    });
    expect(invalidSchool.success).toBe(false);
  });

  test('maps blank optional fields cleanly between create and update DTOs', () => {
    const parsed = classroomFormSchema.parse({
      name: '  Física I  ',
      subject: '   ',
      adultMode: true,
      schoolId: '',
    });

    expect(toCreateClassroomPayload(parsed)).toEqual({
      name: 'Física I',
      adultMode: true,
    });
    expect(toUpdateClassroomPayload(parsed)).toEqual({
      name: 'Física I',
      subject: null,
      adultMode: true,
    });
  });
});

describe('classroom service', () => {
  test('listAccessibleClassrooms sends query params and parses paginated server items', async () => {
    let capturedUrl = '';
    mswServer.use(
      createClassroomListHandler({
        resolveResponse: ({ page, pageSize }) => ({
          items: [validListItem],
          page,
          pageSize,
          total: 15,
        }),
        onRequest: (request) => {
          capturedUrl = request.url;
        },
      }),
    );

    const client = createApiClient();
    const result = await listAccessibleClassrooms(client, {
      page: 2,
      pageSize: 10,
      sort: '-createdAt',
    });

    expect(capturedUrl).toContain('/me/classrooms?page=2&pageSize=10');
    expect(result.items).toEqual([validListItem]);
    expect(result.total).toBe(15);
  });

  test('listAccessibleClassrooms rejects malformed ownership invariants or payload shapes', async () => {
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/me/classrooms`, () =>
        HttpResponse.json({
          items: [
            {
              ...validListItem,
              schoolId: null,
              independentTeacherId: null,
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
        }),
      ),
    );

    const client = createApiClient();
    await expect(listAccessibleClassrooms(client)).rejects.toMatchObject({
      kind: 'unexpected',
    });
  });

  test('createClassroom returns validated server classroom on 201', async () => {
    let sentBody: unknown;
    mswServer.use(
      createCreateClassroomHandler({
        response: validDetail,
        onRequest: (_request, body) => {
          sentBody = body;
        },
      }),
    );

    const client = createApiClient();
    const created = await createClassroom(client, {
      name: '3.º Año B - Matemática',
      subject: 'Matemática y Geometría',
      adultMode: false,
      schoolId: '3f6c2d9e-0000-4000-8000-000000000000',
    });

    expect(sentBody).toEqual({
      name: '3.º Año B - Matemática',
      subject: 'Matemática y Geometría',
      adultMode: false,
      schoolId: '3f6c2d9e-0000-4000-8000-000000000000',
    });
    expect(created).toEqual(validDetail);
  });

  test('createClassroom distinguishes confirmed 400/403/404 rejections from uncertain 500/network/malformed 201', async () => {
    const client = createApiClient();

    mswServer.use(
      createCreateClassroomHandler({
        error: {
          status: 400,
          body: {
            code: 'VALIDATION_FAILED',
            message: 'Validation failed',
            correlationId: 'corr-400',
            details: [
              {
                field: 'schoolId',
                messages: ['schoolId is required'],
              },
            ],
          },
        },
      }),
    );

    let validationError: unknown;
    try {
      await createClassroom(client, { name: 'Aula', adultMode: false });
    } catch (error) {
      validationError = error;
    }
    expect(validationError).toBeInstanceOf(ApiError);
    expect((validationError as ApiError).kind).toBe('validation');
    expect((validationError as ApiError).fieldErrors.schoolId).toEqual([
      'schoolId is required',
    ]);
    expect(isUncertainWriteError(validationError)).toBe(false);

    mswServer.use(
      createCreateClassroomHandler({
        error: {
          status: 403,
          body: {
            code: 'FORBIDDEN',
            message: 'Forbidden',
            correlationId: 'corr-403',
          },
        },
      }),
    );
    await expect(
      createClassroom(client, { name: 'Aula', adultMode: false }),
    ).rejects.toMatchObject({
      kind: 'forbidden',
      userMessage: classroomMessages.form.errors.forbidden,
    });

    mswServer.use(
      createCreateClassroomHandler({
        error: {
          status: 404,
          body: {
            code: 'NOT_FOUND',
            message: 'School not found',
            correlationId: 'corr-404',
          },
        },
      }),
    );
    await expect(
      createClassroom(client, {
        name: 'Aula',
        adultMode: false,
        schoolId: '3f6c2d9e-0000-4000-8000-000000000099',
      }),
    ).rejects.toMatchObject({
      kind: 'not-found',
      userMessage: classroomMessages.form.errors.notFound,
    });

    mswServer.use(
      createCreateClassroomHandler({
        error: {
          status: 500,
          body: {
            code: 'INTERNAL_ERROR',
            message: 'Boom',
            correlationId: 'corr-500',
          },
        },
      }),
    );
    let server500Error: unknown;
    try {
      await createClassroom(client, { name: 'Aula', adultMode: false });
    } catch (error) {
      server500Error = error;
    }
    expect(isUncertainWriteError(server500Error)).toBe(true);
    expect((server500Error as ApiError).userMessage).toBe(
      classroomMessages.form.errors.uncertainWrite,
    );

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/classrooms`, () => HttpResponse.error()),
    );
    let networkError: unknown;
    try {
      await createClassroom(client, { name: 'Aula', adultMode: false });
    } catch (error) {
      networkError = error;
    }
    expect(isUncertainWriteError(networkError)).toBe(true);
    expect((networkError as ApiError).kind).toBe('network');
    expect((networkError as ApiError).userMessage).toBe(
      classroomMessages.form.errors.uncertainWrite,
    );

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/classrooms`, () =>
        HttpResponse.json(
          {
            ...validDetail,
            schoolId: '3f6c2d9e-0000-4000-8000-000000000000',
            independentTeacherId: '00000000-0000-4000-8000-000000000001',
          },
          { status: 201 },
        ),
      ),
    );
    let malformedError: unknown;
    try {
      await createClassroom(client, { name: 'Aula', adultMode: false });
    } catch (error) {
      malformedError = error;
    }
    expect(isUncertainWriteError(malformedError)).toBe(true);
    expect((malformedError as ApiError).userMessage).toBe(
      classroomMessages.form.errors.uncertainWrite,
    );
  });

  test('updateClassroom sends PATCH payload including null subject and classifies confirmed vs uncertain errors', async () => {
    let capturedMethod = '';
    let capturedBody: unknown;
    mswServer.use(
      createUpdateClassroomHandler({
        classroomId: validDetail.id,
        response: {
          ...validDetail,
          name: '3.º Año B - Álgebra',
          subject: null,
          adultMode: true,
        },
        onRequest: (request, _id, body) => {
          capturedMethod = request.method;
          capturedBody = body;
        },
      }),
    );

    const client = createApiClient();
    const updated = await updateClassroom(client, validDetail.id, {
      name: '3.º Año B - Álgebra',
      subject: null,
      adultMode: true,
    });

    expect(capturedMethod).toBe('PATCH');
    expect(capturedBody).toEqual({
      name: '3.º Año B - Álgebra',
      subject: null,
      adultMode: true,
    });
    expect(updated.adultMode).toBe(true);
    expect(updated.subject).toBeNull();

    mswServer.use(
      createUpdateClassroomHandler({
        classroomId: validDetail.id,
        error: {
          status: 403,
          body: {
            code: 'FORBIDDEN',
            message: 'Student cannot update classroom',
            correlationId: 'corr-patch-403',
          },
        },
      }),
    );
    await expect(
      updateClassroom(client, validDetail.id, { name: 'Nuevo' }),
    ).rejects.toMatchObject({
      kind: 'forbidden',
      userMessage: classroomMessages.form.errors.forbidden,
    });

    mswServer.use(
      http.patch(`${TEST_API_BASE_URL}/classrooms/${validDetail.id}`, () =>
        HttpResponse.error(),
      ),
    );
    let patchNetworkError: unknown;
    try {
      await updateClassroom(client, validDetail.id, { name: 'Nuevo' });
    } catch (error) {
      patchNetworkError = error;
    }
    expect(isUncertainWriteError(patchNetworkError)).toBe(true);
  });
});
