import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  classroomMaterialsQueryKey,
  createClassroomMaterialsPredicate,
} from '@/api/query-keys';
import {
  createClassroomMaterialsStore,
  TEST_API_BASE_URL,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import {
  MATERIAL_MAX_SIZE_BYTES,
  materialDownloadDtoSchema,
  validateMaterialFile,
} from './material-schema';
import {
  isUncertainMaterialError,
  listClassroomMaterials,
  removeClassroomMaterial,
  requestMaterialDownload,
  uploadClassroomMaterial,
} from './material-service';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000010';
const MATERIAL_ID = '00000000-0000-4000-8000-000000001001';

describe('material-schema', () => {
  it('accepts valid PDF, PNG, and JPEG files within 10 MiB', () => {
    expect(
      validateMaterialFile(
        new File(['%PDF-1.4'], 'guia.pdf', { type: 'application/pdf' }),
      ),
    ).toEqual({ ok: true });
    expect(
      validateMaterialFile(
        new File(['png'], 'diagrama.png', { type: 'image/png' }),
      ),
    ).toEqual({ ok: true });
    expect(
      validateMaterialFile(
        new File(['jpg'], 'foto.jpg', { type: 'image/jpeg' }),
      ),
    ).toEqual({ ok: true });
  });

  it('rejects disallowed MIME types, empty files, and files over 10 MiB', () => {
    expect(
      validateMaterialFile(
        new File(['<script>'], 'xss.html', { type: 'text/html' }),
      ),
    ).toEqual({ ok: false, reason: 'type' });

    expect(
      validateMaterialFile(
        new File([], 'vacio.pdf', { type: 'application/pdf' }),
      ),
    ).toEqual({ ok: false, reason: 'empty' });

    const oversized = new File(['x'], 'grande.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(oversized, 'size', {
      value: MATERIAL_MAX_SIZE_BYTES + 1,
    });
    expect(validateMaterialFile(oversized)).toEqual({
      ok: false,
      reason: 'size',
    });
  });

  it('rejects non-http(s) signed download URLs', () => {
    expect(
      materialDownloadDtoSchema.safeParse({
        url: 'javascript:alert(1)',
        expiresInSeconds: 60,
      }).success,
    ).toBe(false);
  });
});

describe('classroomMaterialsQueryKey', () => {
  it('isolates cache keys by userId and classroomId and clamps pagination', () => {
    const keyA = classroomMaterialsQueryKey('user-1', 'class-1', {
      page: 0,
      pageSize: 500,
    });
    const keyB = classroomMaterialsQueryKey('user-2', 'class-1', {
      page: 1,
      pageSize: 20,
    });
    const keyC = classroomMaterialsQueryKey('user-1', 'class-2', {
      page: 1,
      pageSize: 20,
    });

    expect(keyA[0].params).toEqual({
      page: 1,
      pageSize: 100,
      sort: '-createdAt',
      moduleId: null,
    });
    expect(
      classroomMaterialsQueryKey('user-1', 'class-1', {
        moduleId: 'unassigned',
      })[0].params.moduleId,
    ).toBe('unassigned');
    expect(keyA).not.toEqual(keyB);
    expect(keyA).not.toEqual(keyC);

    const predicate = createClassroomMaterialsPredicate('user-1', 'class-1');
    expect(predicate({ queryKey: keyA })).toBe(true);
    expect(predicate({ queryKey: keyB })).toBe(false);
    expect(predicate({ queryKey: keyC })).toBe(false);
  });
});

describe('material-service', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('lists materials, uploads a valid file, requests a signed download URL, and removes it', async () => {
    const store = createClassroomMaterialsStore({ classroomId: CLASSROOM_ID });
    mswServer.use(...store.handlers);
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    const initial = await listClassroomMaterials(client, CLASSROOM_ID);
    expect(initial.items).toEqual([]);
    expect(initial.total).toBe(0);

    const file = new File(['%PDF-1.4'], 'unidad-1.pdf', {
      type: 'application/pdf',
    });
    const uploaded = await uploadClassroomMaterial(client, CLASSROOM_ID, file);
    expect(uploaded.filename.length).toBeGreaterThan(0);
    expect(uploaded.contentType).toBe('application/pdf');

    const afterUpload = await listClassroomMaterials(client, CLASSROOM_ID);
    expect(afterUpload.total).toBe(1);
    expect(afterUpload.items[0]?.id).toBe(uploaded.id);

    const download = await requestMaterialDownload(
      client,
      CLASSROOM_ID,
      uploaded.id,
    );
    expect(download.url).toContain(uploaded.id);
    expect(download.expiresInSeconds).toBeGreaterThan(0);

    await removeClassroomMaterial(client, CLASSROOM_ID, uploaded.id);
    const afterRemove = await listClassroomMaterials(client, CLASSROOM_ID);
    expect(afterRemove.total).toBe(0);
  });

  it('maps 400, 413, 403, and 503 upload failures and marks 503/network as uncertain', async () => {
    const store = createClassroomMaterialsStore({ classroomId: CLASSROOM_ID });
    mswServer.use(...store.handlers);
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const file = new File(['%PDF'], 'clase.pdf', { type: 'application/pdf' });

    store.failNext('upload', {
      status: 413,
      body: {
        code: 'BAD_REQUEST',
        message: 'Too large',
        correlationId: 'req-413',
      },
    });
    await expect(
      uploadClassroomMaterial(client, CLASSROOM_ID, file),
    ).rejects.toMatchObject({
      kind: 'validation',
      status: 413,
    });

    store.failNext('upload', {
      status: 403,
      body: {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        correlationId: 'req-403',
      },
    });
    await expect(
      uploadClassroomMaterial(client, CLASSROOM_ID, file),
    ).rejects.toMatchObject({
      kind: 'forbidden',
      status: 403,
    });

    store.failNext('upload', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Timeout',
        correlationId: 'req-503',
      },
    });
    let uncertainError: unknown;
    try {
      await uploadClassroomMaterial(client, CLASSROOM_ID, file);
    } catch (error) {
      uncertainError = error;
    }
    expect(uncertainError).toBeInstanceOf(ApiError);
    expect(isUncertainMaterialError(uncertainError)).toBe(true);
    expect(store.read()).toHaveLength(0);
  });

  it('rethrows AbortError when upload is cancelled', async () => {
    const store = createClassroomMaterialsStore({ classroomId: CLASSROOM_ID });
    mswServer.use(...store.handlers);
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const controller = new AbortController();
    controller.abort();

    await expect(
      uploadClassroomMaterial(
        client,
        CLASSROOM_ID,
        new File(['%PDF'], 'abort.pdf', { type: 'application/pdf' }),
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('translates 404 on download and 403 on remove', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [
        {
          id: MATERIAL_ID,
          classroomId: CLASSROOM_ID,
          authorId: '00000000-0000-4000-8000-000000000001',
          filename: 'guia.pdf',
          contentType: 'application/pdf',
          sizeBytes: 128,
          createdAt: '2026-11-18T03:00:00.000Z',
        },
      ],
    });
    mswServer.use(...store.handlers);
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    await expect(
      requestMaterialDownload(
        client,
        CLASSROOM_ID,
        '00000000-0000-4000-8000-000000009999',
      ),
    ).rejects.toMatchObject({ kind: 'not-found', status: 404 });

    store.failNext('remove', {
      status: 403,
      body: {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        correlationId: 'req-403-rm',
      },
    });
    await expect(
      removeClassroomMaterial(client, CLASSROOM_ID, MATERIAL_ID),
    ).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
  });
});
