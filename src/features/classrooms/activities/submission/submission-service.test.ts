import { http, HttpResponse } from 'msw';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  createClassroomSubmissionsStore,
  TEST_API_BASE_URL,
  type ActivityStoreItem,
  type SubmissionStoreItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import {
  isUncertainSubmissionError,
  MAX_SUBMISSION_FILE_BYTES,
  readOwnSubmission,
  submitActivityFiles,
  type SubmissionSessionPort,
} from './submission-service';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000101';
const ACTIVITY_ID = '00000000-0000-4000-8000-000000005501';
const IDEMPOTENCY_KEY = '11111111-2222-4333-8444-555555555555';
const PDF_BYTES = new TextEncoder().encode(
  '%PDF-1.4\n% synthetic submission\n',
);
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const DOCX_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);

function makePdfFile(name = 'tp1.pdf'): File {
  return new File([PDF_BYTES], name, { type: 'application/pdf' });
}

function makePngFile(name = 'captura.png'): File {
  return new File([PNG_BYTES], name, { type: 'image/png' });
}

function makeDocxFile(name = 'respuesta.docx'): File {
  return new File([DOCX_BYTES], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function makeActivity(
  overrides: Partial<ActivityStoreItem> = {},
): ActivityStoreItem {
  return {
    id: ACTIVITY_ID,
    classroomId: CLASSROOM_ID,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'TP 1: Ecuaciones',
    description: 'Resolver los ejercicios 1 a 5.',
    opensAt: null,
    dueAt: '2026-11-25T23:59:00.000Z',
    allowLate: false,
    maxScore: 100,
    weightMultiplier: 1,
    publishedAt: '2026-11-18T10:00:00.000Z',
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 0,
    createdAt: '2026-11-18T09:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

function makeStoredSubmission(
  overrides: Partial<SubmissionStoreItem> = {},
): SubmissionStoreItem {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    activityId: ACTIVITY_ID,
    submittedAt: '2026-11-18T12:00:00.000Z',
    isLate: false,
    status: 'submitted',
    files: [
      {
        id: '88888888-8888-4888-8888-888888888888',
        originalName: 'tp1.pdf',
        contentType: 'application/pdf',
        sizeBytes: PDF_BYTES.byteLength,
        position: 0,
      },
    ],
    idempotencyKey: IDEMPOTENCY_KEY,
    ...overrides,
  };
}

function makeSession(): {
  port: SubmissionSessionPort;
  refreshCalls: () => number;
} {
  let refreshCount = 0;
  let currentToken = 'synthetic-access';
  const port: SubmissionSessionPort = {
    getAccessToken: () => currentToken,
    refreshAccessToken: async () => {
      refreshCount += 1;
      currentToken = 'synthetic-refreshed';
      return currentToken;
    },
  };
  return { port, refreshCalls: () => refreshCount };
}

function makeClient() {
  return createApiClient({ baseUrl: TEST_API_BASE_URL });
}

function makeStore(
  overrides: Partial<
    Parameters<typeof createClassroomSubmissionsStore>[0]
  > = {},
) {
  return createClassroomSubmissionsStore({
    baseUrl: TEST_API_BASE_URL,
    role: 'STUDENT',
    activity: makeActivity(),
    ...overrides,
  });
}

describe('submission-service', () => {
  beforeAll(() => {
    mswServer.listen();
  });

  afterEach(() => {
    mswServer.resetHandlers();
  });

  afterAll(() => {
    mswServer.close();
  });

  describe('readOwnSubmission', () => {
    it('returns the student own submission with signed download URLs', async () => {
      const store = makeStore({
        initialItems: [makeStoredSubmission()],
      });
      mswServer.use(...store.handlers);

      const submission = await readOwnSubmission(makeClient(), ACTIVITY_ID);

      expect(submission.id).toBe('99999999-9999-4999-8999-999999999999');
      expect(submission.isLate).toBe(false);
      expect(submission.status).toBe('submitted');
      expect(submission.files).toHaveLength(1);
      expect(submission.files[0]?.downloadUrl).toMatch(/^https:\/\//);
      expect(submission.files[0]?.downloadUrlExpiresAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T/,
      );
    });

    it('maps a missing submission to a not-found ApiError', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);

      await expect(
        readOwnSubmission(makeClient(), ACTIVITY_ID),
      ).rejects.toMatchObject({
        kind: 'not-found',
        status: 404,
      });
    });

    it('maps an unknown activity to a not-found ApiError', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);

      await expect(
        readOwnSubmission(makeClient(), '00000000-0000-4000-8000-000000000942'),
      ).rejects.toMatchObject({ kind: 'not-found', status: 404 });
    });

    it('maps staff and parent access to forbidden', async () => {
      for (const role of ['TEACHER', 'SCHOOL_OWNER', 'PARENT'] as const) {
        const store = makeStore({
          role,
          initialItems: [makeStoredSubmission()],
        });
        mswServer.use(...store.handlers);

        await expect(
          readOwnSubmission(makeClient(), ACTIVITY_ID),
        ).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
      }
    });
  });

  describe('submitActivityFiles', () => {
    it('stores a submission, sends the idempotency key, and reports completion progress', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const onProgress = vi.fn();
      const { port } = makeSession();

      const submission = await submitActivityFiles(
        port,
        ACTIVITY_ID,
        [makePdfFile()],
        {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
          onProgress,
        },
      );

      expect(submission.status).toBe('submitted');
      expect(submission.isLate).toBe(false);
      expect(submission.files).toHaveLength(1);
      expect(submission.files[0]?.originalName).toBe('tp1.pdf');
      expect(store.getItems()).toHaveLength(1);

      const lastRequest = store.getLastCreateRequest();
      expect(lastRequest?.idempotencyKey).toBe(IDEMPOTENCY_KEY);
      expect(lastRequest?.authorization).toBe('Bearer synthetic-access');
      expect(lastRequest?.accessTokenUsed).toBe('synthetic-access');

      const totalBytes = PDF_BYTES.byteLength;
      expect(onProgress).toHaveBeenCalledWith(totalBytes, totalBytes);
    });

    it('replays the same idempotency key without storing a duplicate', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const { port } = makeSession();

      const first = await submitActivityFiles(
        port,
        ACTIVITY_ID,
        [makePdfFile()],
        {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
        },
      );

      const second = await submitActivityFiles(
        port,
        ACTIVITY_ID,
        [makePdfFile()],
        {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
        },
      );

      expect(second.id).toBe(first.id);
      expect(store.getItems()).toHaveLength(1);
    });

    it('rejects a different key after a submission exists', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const { port } = makeSession();

      await submitActivityFiles(port, ACTIVITY_ID, [makePdfFile()], {
        baseUrl: TEST_API_BASE_URL,
        idempotencyKey: IDEMPOTENCY_KEY,
      });

      await expect(
        submitActivityFiles(port, ACTIVITY_ID, [makePdfFile()], {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        }),
      ).rejects.toMatchObject({ kind: 'conflict', status: 409 });
    });

    it('stores a late submission with the late flag when the activity allows it', async () => {
      const store = makeStore({
        activity: makeActivity({
          dueAt: '2026-11-10T23:59:00.000Z',
          allowLate: true,
        }),
      });
      mswServer.use(...store.handlers);
      const { port } = makeSession();

      const submission = await submitActivityFiles(
        port,
        ACTIVITY_ID,
        [makePdfFile()],
        {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
        },
      );

      expect(submission.isLate).toBe(true);
      expect(store.getItems()[0]?.isLate).toBe(true);
    });

    it('rejects a submission after the window closed without late allowance', async () => {
      const store = makeStore({
        activity: makeActivity({
          dueAt: '2026-11-10T23:59:00.000Z',
          allowLate: false,
        }),
      });
      mswServer.use(...store.handlers);
      const { port } = makeSession();

      const error = await submitActivityFiles(
        port,
        ACTIVITY_ID,
        [makePdfFile()],
        {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
        },
      ).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ kind: 'conflict', status: 409 });
      expect((error as ApiError).userMessage).toBe(
        'La fecha límite de entrega ya pasó y la actividad no admite entregas tardías.',
      );
      expect(store.getItems()).toHaveLength(0);
    });

    it('rejects an activity that is not open yet', async () => {
      const store = makeStore({
        activity: makeActivity({
          opensAt: '2026-11-20T10:00:00.000Z',
        }),
      });
      mswServer.use(...store.handlers);
      const { port } = makeSession();

      await expect(
        submitActivityFiles(port, ACTIVITY_ID, [makePdfFile()], {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
        }),
      ).rejects.toMatchObject({ kind: 'conflict', status: 409 });
    });

    it('rejects non-member access with not-found so existence never leaks', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const { port } = makeSession();

      await expect(
        submitActivityFiles(
          port,
          '00000000-0000-4000-8000-000000000942',
          [makePdfFile()],
          {
            baseUrl: TEST_API_BASE_URL,
            idempotencyKey: IDEMPOTENCY_KEY,
          },
        ),
      ).rejects.toMatchObject({ kind: 'not-found', status: 404 });
      expect(store.getItems()).toHaveLength(0);
    });

    it('rejects staff and parents with forbidden', async () => {
      for (const role of ['TEACHER', 'SCHOOL_OWNER', 'PARENT'] as const) {
        const store = makeStore({ role });
        mswServer.use(...store.handlers);
        const { port } = makeSession();

        await expect(
          submitActivityFiles(port, ACTIVITY_ID, [makePdfFile()], {
            baseUrl: TEST_API_BASE_URL,
            idempotencyKey: IDEMPOTENCY_KEY,
          }),
        ).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
      }
    });

    it('rejects a file over the server size limit with 413', async () => {
      const store = makeStore({ fileSizeLimitBytes: PDF_BYTES.byteLength - 1 });
      mswServer.use(...store.handlers);
      const { port } = makeSession();

      await expect(
        submitActivityFiles(port, ACTIVITY_ID, [makePdfFile()], {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
        }),
      ).rejects.toMatchObject({ status: 413 });
    });

    it('rejects a file whose bytes are not an allowed type', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const { port } = makeSession();

      const disguised = new File(
        [new TextEncoder().encode('esto no es un PDF')],
        'falso.pdf',
        { type: 'application/pdf' },
      );

      const error = await submitActivityFiles(port, ACTIVITY_ID, [disguised], {
        baseUrl: TEST_API_BASE_URL,
        idempotencyKey: IDEMPOTENCY_KEY,
      }).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ kind: 'validation', status: 400 });
      expect((error as ApiError).userMessage).toBe(
        'Uno de los archivos no es un PDF, PNG, JPEG o DOCX válido.',
      );
      expect(store.getItems()).toHaveLength(0);
    });

    it('marks a lost response as uncertain while the server stored the submission', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const { port } = makeSession();
      store.failNext('create', 'drop-response');

      const error = await submitActivityFiles(
        port,
        ACTIVITY_ID,
        [makePdfFile()],
        {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
        },
      ).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(ApiError);
      expect(isUncertainSubmissionError(error)).toBe(true);
      expect(store.getItems()).toHaveLength(1);

      const reconciled = await readOwnSubmission(makeClient(), ACTIVITY_ID);
      expect(reconciled.id).toBe(store.getItems()[0]?.id);
    });

    it('marks a network failure as uncertain without storing anything', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const { port } = makeSession();
      store.failNext('create', 'network');

      const error = await submitActivityFiles(
        port,
        ACTIVITY_ID,
        [makePdfFile()],
        {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
        },
      ).catch((cause: unknown) => cause);

      expect(isUncertainSubmissionError(error)).toBe(true);
      expect(store.getItems()).toHaveLength(0);
    });

    it('retries once through token refresh after a 401', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const { port, refreshCalls } = makeSession();
      store.failNext('create', {
        status: 401,
        body: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
          correlationId: 'req-submissions-create-401',
        },
      });

      const submission = await submitActivityFiles(
        port,
        ACTIVITY_ID,
        [makePdfFile()],
        {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
        },
      );

      expect(refreshCalls()).toBe(1);
      expect(submission.status).toBe('submitted');
      expect(store.getItems()).toHaveLength(1);
      expect(store.getLastCreateRequest()?.accessTokenUsed).toBe(
        'synthetic-refreshed',
      );
    });

    it('honors a cancellation that lands during the token refresh window', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const controller = new AbortController();
      let refreshCount = 0;
      const port: SubmissionSessionPort = {
        getAccessToken: () => 'synthetic-access',
        refreshAccessToken: async () => {
          refreshCount += 1;
          // The user cancels while the refresh is resolving.
          controller.abort();
          return 'synthetic-refreshed';
        },
      };
      store.failNext('create', {
        status: 401,
        body: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
          correlationId: 'req-submissions-create-401',
        },
      });

      const error = await submitActivityFiles(port, ACTIVITY_ID, [
        makePdfFile(),
      ], {
        baseUrl: TEST_API_BASE_URL,
        idempotencyKey: IDEMPOTENCY_KEY,
        signal: controller.signal,
      }).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe('AbortError');
      expect(refreshCount).toBe(1);
      // The 401 attempt stored nothing and the replay was never sent.
      expect(store.getItems()).toHaveLength(0);
    });

    it('rejects an aborted upload as an expected cancellation', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const { port } = makeSession();
      const controller = new AbortController();
      controller.abort();

      const error = await submitActivityFiles(
        port,
        ACTIVITY_ID,
        [makePdfFile()],
        {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
          signal: controller.signal,
        },
      ).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe('AbortError');
      expect(store.getItems()).toHaveLength(0);
      expect(store.getLastCreateRequest()).toBeNull();
    });

    it('validates the file count before sending anything', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const { port } = makeSession();

      await expect(
        submitActivityFiles(port, ACTIVITY_ID, [], {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
        }),
      ).rejects.toMatchObject({
        kind: 'validation',
        userMessage: 'Elegí entre 1 y 5 archivos para tu entrega.',
      });

      await expect(
        submitActivityFiles(
          port,
          ACTIVITY_ID,
          Array.from({ length: 6 }, (_, index) =>
            makePdfFile(`tp${index}.pdf`),
          ),
          {
            baseUrl: TEST_API_BASE_URL,
            idempotencyKey: IDEMPOTENCY_KEY,
          },
        ),
      ).rejects.toMatchObject({
        kind: 'validation',
        userMessage: 'Elegí entre 1 y 5 archivos para tu entrega.',
      });

      expect(store.getItems()).toHaveLength(0);
      expect(store.getLastCreateRequest()).toBeNull();
    });

    it('validates disallowed extensions before sending anything', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const { port } = makeSession();

      const script = new File([PDF_BYTES], 'script.exe', {
        type: 'application/pdf',
      });

      const error = await submitActivityFiles(port, ACTIVITY_ID, [script], {
        baseUrl: TEST_API_BASE_URL,
        idempotencyKey: IDEMPOTENCY_KEY,
      }).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ kind: 'validation' });
      expect((error as ApiError).userMessage).toBe(
        'Uno de los archivos no es un PDF, PNG, JPEG o DOCX válido.',
      );
      expect(store.getItems()).toHaveLength(0);
      expect(store.getLastCreateRequest()).toBeNull();
    });

    it('validates oversize files before sending anything', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const { port } = makeSession();

      const oversize = new File(
        [new Uint8Array(MAX_SUBMISSION_FILE_BYTES + 1)],
        'enorme.pdf',
        { type: 'application/pdf' },
      );

      const error = await submitActivityFiles(port, ACTIVITY_ID, [oversize], {
        baseUrl: TEST_API_BASE_URL,
        idempotencyKey: IDEMPOTENCY_KEY,
      }).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ kind: 'validation' });
      expect((error as ApiError).userMessage).toBe(
        'Cada archivo puede pesar hasta 10 MB.',
      );
      expect(store.getItems()).toHaveLength(0);
      expect(store.getLastCreateRequest()).toBeNull();
    });

    it('rejects a missing idempotency key locally', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const { port } = makeSession();

      await expect(
        submitActivityFiles(port, ACTIVITY_ID, [makePdfFile()], {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: '  ',
        }),
      ).rejects.toMatchObject({ kind: 'validation' });

      expect(store.getItems()).toHaveLength(0);
      expect(store.getLastCreateRequest()).toBeNull();
    });

    it('rejects a malformed confirmed payload instead of trusting it', async () => {
      // Register only the preflight and a malformed POST so the store's own
      // create handler cannot answer this request first.
      mswServer.use(
        http.options(
          `${TEST_API_BASE_URL}/activities/${ACTIVITY_ID}/submissions`,
          () =>
            new HttpResponse(null, {
              status: 204,
              headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'POST, GET, OPTIONS',
                'access-control-allow-headers':
                  'authorization, idempotency-key, accept, content-type',
              },
            }),
        ),
        http.post(
          `${TEST_API_BASE_URL}/activities/${ACTIVITY_ID}/submissions`,
          () =>
            HttpResponse.json(
              { unexpected: 'not a SubmissionResponseDto' },
              {
                status: 201,
                headers: { 'access-control-allow-origin': '*' },
              },
            ),
        ),
      );
      const { port } = makeSession();

      const error = await submitActivityFiles(
        port,
        ACTIVITY_ID,
        [makePdfFile()],
        {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
        },
      ).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ kind: 'unexpected', status: 201 });
    });

    it('accepts up to five allowed files in order', async () => {
      const store = makeStore();
      mswServer.use(...store.handlers);
      const { port } = makeSession();

      const submission = await submitActivityFiles(
        port,
        ACTIVITY_ID,
        [
          makePdfFile('a.pdf'),
          makePngFile('b.png'),
          makeDocxFile('c.docx'),
          makePdfFile('d.pdf'),
          makePngFile('e.png'),
        ],
        {
          baseUrl: TEST_API_BASE_URL,
          idempotencyKey: IDEMPOTENCY_KEY,
        },
      );

      expect(submission.files.map((file) => file.position)).toEqual([
        0, 1, 2, 3, 4,
      ]);
      expect(submission.files.map((file) => file.originalName)).toEqual([
        'a.pdf',
        'b.png',
        'c.docx',
        'd.pdf',
        'e.png',
      ]);
    });
  });
});
