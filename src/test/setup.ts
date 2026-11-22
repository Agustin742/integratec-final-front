import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cold Vite transforms of lazy feature route modules during parallel test runs
// can exceed the default 1000ms waitFor ceiling on Windows.
configure({ asyncUtilTimeout: 5000 });

// Feature components render inside an app that booted with a valid public
// config (`src/main.tsx` validates before mounting). Provide the same minimal
// defaults that `vite.config.ts` test/preview builds use, so feature code
// reading `getPublicConfig()` works in suites without a local `.env`
// (worktrees do not carry the untracked one). Suites may still override these
// with `vi.stubEnv` for their own scenarios, including missing-value errors.
vi.stubEnv('VITE_APP_ENV', 'test');
vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.invalid');
vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');

// Vitest globals are disabled, so register cleanup explicitly.
afterEach(cleanup);
