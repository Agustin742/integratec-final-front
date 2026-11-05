import { defineConfig, devices } from '@playwright/test';

const remoteURL = process.env.PLAYWRIGHT_BASE_URL;
const localURL = 'http://127.0.0.1:4173';

if (remoteURL !== undefined) {
  let url: URL;
  try {
    url = new URL(remoteURL);
  } catch {
    throw new Error(
      'PLAYWRIGHT_BASE_URL must be an absolute HTTP(S) URL without credentials.',
    );
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'PLAYWRIGHT_BASE_URL must be an absolute HTTP(S) URL without credentials.',
    );
  }
}

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  timeout: 15_000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: { baseURL: remoteURL ?? localURL },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Explicit remote targets skip preview; the smoke must remain read-only.
  webServer:
    remoteURL === undefined
      ? {
          // Reuse the invoking Node/pnpm, not a different global pnpm shim.
          command: `"${process.execPath}" "${process.env.npm_execpath}" preview --host 127.0.0.1 --port 4173 --strictPort`,
          url: localURL,
          reuseExistingServer: false,
          timeout: 15_000,
        }
      : undefined,
});
