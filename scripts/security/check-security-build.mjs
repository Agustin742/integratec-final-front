import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import {
  PUBLIC_CONFIG_VARIABLES,
  loadPublicConfig,
} from '../../src/config/public-config.ts';
import {
  buildSecurityHeaders,
  renderCustomHttpYaml,
  validateBuiltHtmlAndHeaders,
} from '../../src/config/security-headers.ts';

const root = process.cwd();
const distDir = resolve(root, 'dist');
const distIndexHtmlPath = resolve(distDir, 'index.html');
const distCustomHttpPath = resolve(distDir, 'customHttp.yml');
const rootCustomHttpPath = resolve(root, 'customHttp.yml');

if (!existsSync(distIndexHtmlPath)) {
  console.error(
    '[security:check] ERROR: dist/index.html is missing. Run "pnpm build" before "pnpm security:check".',
  );
  process.exit(1);
}

if (!existsSync(distCustomHttpPath)) {
  console.error(
    '[security:check] ERROR: dist/customHttp.yml is missing. Run "pnpm build" before "pnpm security:check".',
  );
  process.exit(1);
}

if (!existsSync(rootCustomHttpPath)) {
  console.error(
    '[security:check] ERROR: root customHttp.yml is missing from the repository.',
  );
  process.exit(1);
}

const loaded = loadEnv(process.env.MODE ?? 'production', root, 'VITE_');
const merged = { ...loaded };
for (const variable of PUBLIC_CONFIG_VARIABLES) {
  if (process.env[variable] !== undefined) {
    merged[variable] = process.env[variable];
  }
}
merged.VITE_APP_ENV ??= 'test';
merged.VITE_API_BASE_URL ??= 'https://api.example.invalid';
merged.VITE_REALTIME_URL ??= 'wss://realtime.example.invalid';

try {
  const publicConfig = loadPublicConfig(merged);
  const indexHtml = readFileSync(distIndexHtmlPath, 'utf8');
  const distCustomHttpYaml = readFileSync(
    distCustomHttpPath,
    'utf8',
  ).replaceAll('\r\n', '\n');
  const headers = buildSecurityHeaders(publicConfig);

  validateBuiltHtmlAndHeaders({
    indexHtml,
    headers,
    customHttpYaml: distCustomHttpYaml,
  });

  const templateConfig = loadPublicConfig({
    VITE_APP_ENV: 'test',
    VITE_API_BASE_URL: 'https://api.example.invalid',
    VITE_REALTIME_URL: 'wss://realtime.example.invalid',
  });
  const rootCustomHttpYaml = readFileSync(
    rootCustomHttpPath,
    'utf8',
  ).replaceAll('\r\n', '\n');
  const expectedRootYaml = renderCustomHttpYaml(templateConfig);

  if (rootCustomHttpYaml !== expectedRootYaml) {
    throw new Error(
      'Repository root customHttp.yml does not match the canonical security header template.',
    );
  }

  console.log(
    '[security:check] Passed: dist/index.html has no inline scripts and customHttp.yml enforces strict CSP and security headers.',
  );
} catch (error) {
  console.error(
    '[security:check] ERROR:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
}
