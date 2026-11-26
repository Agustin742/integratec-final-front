import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  BOT_INDEX_FAILURE_REASON,
  createClassroomMaterialsStore,
  TEST_API_BASE_URL,
  type BotMaterialStateEntry,
  type ClassroomMaterialItem,
} from '@/test/msw/handlers';
import {
  disableClassroomBotMaterial,
  enableClassroomBotMaterial,
  isUncertainBotMaterialError,
  listClassroomBotMaterials,
} from './material-bot-service';
import { materialMessages } from './messages';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000010';
const MATERIAL_ID = '00000000-0000-4000-8000-000000000101';

const ITEM: ClassroomMaterialItem = {
  id: MATERIAL_ID,
  classroomId: CLASSROOM_ID,
  authorId: '00000000-0000-4000-8000-000000000001',
  filename: 'guia-unidad-1.pdf',
  contentType: 'application/pdf',
  sizeBytes: 2048,
  createdAt: '2026-11-18T10:00:00.000Z',
};

function allowedEntry(index: number): BotMaterialStateEntry {
  const suffix = String(index).padStart(12, '0');
  return {
    id: `00000000-0000-4000-9000-${suffix}`,
    classroomId: CLASSROOM_ID,
    materialId: `00000000-0000-4000-8000-${suffix}`,
    filename: `guia-${index}.pdf`,
    contentType: 'application/pdf',
    sizeBytes: 1024,
    indexState: 'INDEXED',
    failureReason: null,
    createdAt: '2026-11-19T01:00:00.000Z',
  };
}

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function setup(initialBotStates: readonly BotMaterialStateEntry[] = []) {
  const store = createClassroomMaterialsStore({
    classroomId: CLASSROOM_ID,
    initialItems: [ITEM],
    initialBotStates,
  });
  server.use(...store.handlers);
  return { store, client: createApiClient({ baseUrl: TEST_API_BASE_URL }) };
}

const enable = (client: ReturnType<typeof createApiClient>) =>
  enableClassroomBotMaterial(client, CLASSROOM_ID, MATERIAL_ID);
const disable = (client: ReturnType<typeof createApiClient>) =>
  disableClassroomBotMaterial(client, CLASSROOM_ID, MATERIAL_ID);

describe('material-bot-service', () => {
  it('enables with POST, lists the allowed material and disables with DELETE', async () => {
    const { client } = setup();

    expect(await listClassroomBotMaterials(client, CLASSROOM_ID)).toEqual({
      items: [],
    });

    const enabled = await enable(client);
    expect(enabled).toMatchObject({
      materialId: MATERIAL_ID,
      indexState: 'INDEXED',
      failureReason: null,
    });
    const listed = await listClassroomBotMaterials(client, CLASSROOM_ID);
    expect(listed.items).toEqual([enabled]);

    await expect(disable(client)).resolves.toBeUndefined();
    expect(await listClassroomBotMaterials(client, CLASSROOM_ID)).toEqual({
      items: [],
    });
  });

  it('reads every page when the classroom has more allowed materials than one page', async () => {
    const { client, store } = setup(
      Array.from({ length: 205 }, (_, index) => allowedEntry(index + 1)),
    );

    const listed = await listClassroomBotMaterials(client, CLASSROOM_ID);

    expect(listed.items).toHaveLength(205);
    expect(new Set(listed.items.map((entry) => entry.materialId)).size).toBe(
      205,
    );
    expect(store.botListCalls).toEqual([1, 2, 3]);
  });

  it('returns a failed indexing as a confirmed result that can be retried', async () => {
    const { client, store } = setup();
    store.setBotIndexOutcome('FAILED');

    expect(await enable(client)).toMatchObject({
      indexState: 'FAILED',
      failureReason: BOT_INDEX_FAILURE_REASON,
    });

    store.setBotIndexOutcome('INDEXED');
    expect(await enable(client)).toMatchObject({ indexState: 'INDEXED' });
  });

  it('translates 404, pending cleanup and uncertain failures', async () => {
    const { client, store } = setup();

    await expect(disable(client)).rejects.toMatchObject({
      kind: 'not-found',
      status: 404,
    });

    await enable(client);
    store.failNext('botDisable', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Cleanup pending',
        correlationId: 'req-bot-503',
      },
    });
    const cleanup = await disable(client).catch((error: unknown) => error);
    expect(cleanup).toBeInstanceOf(ApiError);
    expect((cleanup as ApiError).userMessage).toBe(
      materialMessages.list.bot.toggleErrors.cleanupPending,
    );
    expect(isUncertainBotMaterialError(cleanup)).toBe(true);

    store.failNext('botEnable', 'network');
    const offline = await enable(client).catch((error: unknown) => error);
    expect(isUncertainBotMaterialError(offline)).toBe(true);

    server.use(
      http.post(`${TEST_API_BASE_URL}/classrooms/:id/bot/materials`, () =>
        HttpResponse.json({ invalid: true }, { status: 201 }),
      ),
    );
    const malformed = await enable(client).catch((error: unknown) => error);
    expect(isUncertainBotMaterialError(malformed)).toBe(true);
  });
});
