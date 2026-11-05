import { setupServer } from 'msw/node';
import { defaultHandlers } from './handlers';

/**
 * Shared MSW server for Vitest integration tests.
 * Development and test only (FD9); never imported by production application code.
 */
export const mswServer = setupServer(...defaultHandlers);
