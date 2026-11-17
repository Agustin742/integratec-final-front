import { describe, expect, test } from 'vitest';
import { createAuthTransport } from './transport';
import { harness, json, login } from './test-fixtures';

const fieldErrors = { email: ['Synthetic safe field feedback'] };
const errorBody = {
  error: {
    code: 'VALIDATION_FAILED',
    message: 'Synthetic internal diagnostic',
    details: [{ field: 'email', messages: fieldErrors.email }],
    correlationId: 'corr-transport',
  },
};

describe('authentication transport error boundary', () => {
  test.each([400, 429, 500])(
    'retains safe non-401 login metadata for status %s',
    async (status) => {
      const auth = createAuthTransport(harness(() => json(errorBody, status)));
      await expect(
        auth.login(login, new AbortController().signal),
      ).rejects.toMatchObject({
        status,
        fieldErrors,
        correlationId: 'corr-transport',
        details: [],
      });
    },
  );

  test('401 login never exposes field hints, raw messages or diagnostics', async () => {
    const auth = createAuthTransport(harness(() => json(errorBody, 401)));
    await expect(
      auth.login(login, new AbortController().signal),
    ).rejects.toMatchObject({
      status: 401,
      fieldErrors: {},
      correlationId: null,
      details: [],
    });
  });

  test.each(['refresh', 'logout'] as const)(
    'keeps %s error sanitization unchanged',
    async (operation) => {
      const auth = createAuthTransport(harness(() => json(errorBody, 400)));
      const signal = new AbortController().signal;
      await expect(
        auth[operation]('synthetic-token', signal),
      ).rejects.toMatchObject({
        status: 400,
        fieldErrors: {},
        correlationId: null,
        details: [],
      });
    },
  );
});
