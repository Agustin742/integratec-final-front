import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig({ command: 'serve', mode: 'test' }),
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      projects: [
        {
          extends: true,
          test: {
            name: 'tooling',
            include: ['src/config/eslint-security.test.ts'],
            fileParallelism: false,
            // Group 0 single-worker projects run last in the installed Vitest.
            sequence: { groupOrder: 1 },
          },
        },
        {
          extends: true,
          test: {
            name: 'application',
            // Bound resource contention while retaining per-file isolation and timeouts.
            maxWorkers: 2,
            include: ['src/**/*.test.{ts,tsx}'],
            exclude: [
              ...configDefaults.exclude,
              'src/config/eslint-security.test.ts',
            ],
            sequence: { groupOrder: 2 },
          },
        },
      ],
    },
  }),
);
