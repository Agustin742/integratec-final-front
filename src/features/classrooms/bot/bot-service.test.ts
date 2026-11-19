import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createApiClient } from '@/api/client';
import {
  createClassroomBotStore,
  TEST_API_BASE_URL,
} from '@/test/msw/handlers';
import {
  BotServiceError,
  askStudyGuideBot,
  fetchClassroomBotStatus,
} from './bot-service';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000010';
const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('bot-service (HU-BOT-002)', () => {
  it('fetches availability status and answers questions with citations', async () => {
    const store = createClassroomBotStore({ classroomId: CLASSROOM_ID });
    server.use(...store.handlers);
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    const status = await fetchClassroomBotStatus(client, CLASSROOM_ID);
    expect(status.available).toBe(true);

    const reply = await askStudyGuideBot(client, CLASSROOM_ID, {
      question: '¿Qué es una fracción equivalente?',
    });
    expect(reply.outcome).toBe('answered');
    expect(reply.citations).toHaveLength(1);
    expect(reply.citations[0]?.filename).toBe('guia-unidad-1.pdf');
  });

  it('classifies exam lockout (409), rate limit (429), provider outage (503), and 403 distinctly', async () => {
    const store = createClassroomBotStore({ classroomId: CLASSROOM_ID });
    server.use(...store.handlers);
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    store.setExamLocked(true, 'Tenés un examen activo hasta las 15:00.');
    await expect(
      askStudyGuideBot(client, CLASSROOM_ID, { question: 'Ayuda' }),
    ).rejects.toMatchObject({
      name: 'BotServiceError',
      category: 'exam_locked',
    });

    store.setExamLocked(false);
    store.failNext('ask', {
      status: 429,
      body: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded',
        correlationId: 'req-bot-429',
      },
    });
    await expect(
      askStudyGuideBot(client, CLASSROOM_ID, { question: 'Hola' }),
    ).rejects.toMatchObject({
      category: 'rate_limited',
    });

    store.failNext('ask', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Bedrock timeout',
        correlationId: 'req-bot-503',
      },
    });
    await expect(
      askStudyGuideBot(client, CLASSROOM_ID, { question: 'Hola' }),
    ).rejects.toMatchObject({
      category: 'provider_unavailable',
    });

    store.failNext('ask', {
      status: 403,
      body: {
        code: 'FORBIDDEN',
        message: 'Parents cannot use the bot',
        correlationId: 'req-bot-403',
      },
    });
    try {
      await askStudyGuideBot(client, CLASSROOM_ID, { question: 'Hola' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BotServiceError);
      expect((error as BotServiceError).category).toBe('forbidden');
    }
  });
});
