import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  createClassroomMaterialsStore,
  TEST_API_BASE_URL,
} from '@/test/msw/handlers';
import { botAllowedMaterialDtoSchema } from './material-bot-schema';
import {
  isUncertainBotMaterialError,
  listClassroomBotMaterials,
  setClassroomBotMaterialEnabled,
} from './material-bot-service';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000010';
const MATERIAL_ID = '00000000-0000-4000-8000-000000000101';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('material-bot-service', () => {
  it('lists and toggles bot-enabled state with server-confirmed indexingStatus', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [
        {
          id: MATERIAL_ID,
          classroomId: CLASSROOM_ID,
          authorId: '00000000-0000-4000-8000-000000000001',
          filename: 'guia-unidad-1.pdf',
          contentType: 'application/pdf',
          sizeBytes: 2048,
          createdAt: '2026-11-18T10:00:00.000Z',
        },
      ],
    });
    server.use(...store.handlers);
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    const initial = await listClassroomBotMaterials(client, CLASSROOM_ID);
    expect(initial.items).toEqual([]);

    const enabled = await setClassroomBotMaterialEnabled(
      client,
      CLASSROOM_ID,
      MATERIAL_ID,
      { enabled: true },
    );
    expect(enabled.botEnabled).toBe(true);
    expect(enabled.indexingStatus).toBe('pending');

    store.setBotState(MATERIAL_ID, {
      botEnabled: true,
      indexingStatus: 'ready',
    });
    const afterReady = await listClassroomBotMaterials(client, CLASSROOM_ID);
    expect(afterReady.items).toHaveLength(1);
    expect(afterReady.items[0]?.indexingStatus).toBe('ready');

    const disabled = await setClassroomBotMaterialEnabled(
      client,
      CLASSROOM_ID,
      MATERIAL_ID,
      { enabled: false },
    );
    expect(disabled.botEnabled).toBe(false);
    expect(disabled.indexingStatus).toBe('disabled');
  });

  it('rejects malformed payloads and marks 5xx/network toggle errors as uncertain', async () => {
    const store = createClassroomMaterialsStore({
      classroomId: CLASSROOM_ID,
      initialItems: [
        {
          id: MATERIAL_ID,
          classroomId: CLASSROOM_ID,
          authorId: '00000000-0000-4000-8000-000000000001',
          filename: 'guia.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024,
          createdAt: '2026-11-18T10:00:00.000Z',
        },
      ],
    });
    server.use(...store.handlers);
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    store.failNext('botToggle', {
      status: 403,
      body: {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        correlationId: 'req-bot-403',
      },
    });
    await expect(
      setClassroomBotMaterialEnabled(client, CLASSROOM_ID, MATERIAL_ID, {
        enabled: true,
      }),
    ).rejects.toMatchObject({
      kind: 'forbidden',
      status: 403,
    });

    store.failNext('botToggle', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Try again later',
        correlationId: 'req-bot-503',
      },
    });
    let caught: unknown;
    try {
      await setClassroomBotMaterialEnabled(client, CLASSROOM_ID, MATERIAL_ID, {
        enabled: true,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(isUncertainBotMaterialError(caught)).toBe(true);

    server.use(
      http.put(
        `${TEST_API_BASE_URL}/classrooms/:id/bot/materials/:materialId`,
        () => HttpResponse.json({ invalid: true }),
      ),
    );
    let malformedError: unknown;
    try {
      await setClassroomBotMaterialEnabled(client, CLASSROOM_ID, MATERIAL_ID, {
        enabled: true,
      });
    } catch (error) {
      malformedError = error;
    }
    expect(isUncertainBotMaterialError(malformedError)).toBe(true);
  });

  it('validates failed indexing status with error message in schema', () => {
    const parsed = botAllowedMaterialDtoSchema.safeParse({
      materialId: MATERIAL_ID,
      classroomId: CLASSROOM_ID,
      botEnabled: true,
      indexingStatus: 'failed',
      indexingError: 'El PDF no contiene texto extraíble.',
      updatedAt: '2026-11-19T01:30:00.000Z',
    });
    expect(parsed.success).toBe(true);
  });
});
