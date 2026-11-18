import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cold Vite transforms of lazy feature route modules during parallel test runs
// can exceed the default 1000ms waitFor ceiling on Windows.
configure({ asyncUtilTimeout: 5000 });

// Vitest globals are disabled, so register cleanup explicitly.
afterEach(cleanup);
