import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

export const TEMPLATE_ENV = Object.freeze({
  VITE_APP_ENV: 'test',
  VITE_API_BASE_URL: 'https://api.example.invalid',
  VITE_REALTIME_URL: 'wss://realtime.example.invalid',
});

export function resolveSecurityConfig(
  root = process.cwd(),
  envOverrides = process.env,
) {
  const mode =
    typeof envOverrides.MODE === 'string' && envOverrides.MODE.trim() !== ''
      ? envOverrides.MODE
      : 'production';
  const loaded = loadEnv(mode, root, 'VITE_');
  const merged = { ...loaded };
  for (const variable of PUBLIC_CONFIG_VARIABLES) {
    if (envOverrides[variable] !== undefined) {
      merged[variable] = envOverrides[variable];
    }
  }
  merged.VITE_APP_ENV ??= TEMPLATE_ENV.VITE_APP_ENV;
  merged.VITE_API_BASE_URL ??= TEMPLATE_ENV.VITE_API_BASE_URL;
  merged.VITE_REALTIME_URL ??= TEMPLATE_ENV.VITE_REALTIME_URL;

  return loadPublicConfig(merged);
}

/**
 * Synchronizes the AWS Amplify Hosting root `customHttp.yml` (and `dist/customHttp.yml` when `dist/` exists)
 * with the active `PublicConfig` so Amplify's repository-root `customHttp.yml` reader receives the
 * exact `connect-src` origins for the target environment (#21 / #22 handoff).
 */
export function syncCustomHttpFiles({
  root = process.cwd(),
  env = process.env,
} = {}) {
  const publicConfig = resolveSecurityConfig(root, env);
  const yaml = renderCustomHttpYaml(publicConfig);
  const rootCustomHttpPath = resolve(root, 'customHttp.yml');
  writeFileSync(rootCustomHttpPath, yaml, 'utf8');

  const distDir = resolve(root, 'dist');
  const distCustomHttpPath = resolve(distDir, 'customHttp.yml');
  if (existsSync(distDir)) {
    writeFileSync(distCustomHttpPath, yaml, 'utf8');
  }

  return { publicConfig, yaml, rootCustomHttpPath };
}

/**
 * Verifies the built `dist/index.html`, `dist/customHttp.yml`, and repository-root `customHttp.yml`.
 *
 * - Always validates `dist/index.html` and `dist/customHttp.yml` against the active `PublicConfig`
 *   (including exact `connect-src` origin matching).
 * - When `requireRootMatchActiveConfig` is true (used in Amplify builds after `pnpm security:sync`),
 *   verifies that the repository-root `customHttp.yml` also matches the active `PublicConfig`.
 * - Otherwise (local/CI default), verifies that the repository-root `customHttp.yml` matches either
 *   the active `PublicConfig` or the committed canonical template.
 */
export function runSecurityBuildCheck({
  root = process.cwd(),
  env = process.env,
  requireRootMatchActiveConfig = false,
} = {}) {
  const distDir = resolve(root, 'dist');
  const distIndexHtmlPath = resolve(distDir, 'index.html');
  const distCustomHttpPath = resolve(distDir, 'customHttp.yml');
  const rootCustomHttpPath = resolve(root, 'customHttp.yml');

  if (!existsSync(distIndexHtmlPath)) {
    throw new Error(
      'dist/index.html is missing. Run "pnpm build" before "pnpm security:check".',
    );
  }

  if (!existsSync(distCustomHttpPath)) {
    throw new Error(
      'dist/customHttp.yml is missing. Run "pnpm build" before "pnpm security:check".',
    );
  }

  if (!existsSync(rootCustomHttpPath)) {
    throw new Error('root customHttp.yml is missing from the repository.');
  }

  const publicConfig = resolveSecurityConfig(root, env);
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
    expectedConfig: publicConfig,
  });

  const rootCustomHttpYaml = readFileSync(
    rootCustomHttpPath,
    'utf8',
  ).replaceAll('\r\n', '\n');
  const expectedActiveYaml = renderCustomHttpYaml(publicConfig);

  if (requireRootMatchActiveConfig) {
    validateBuiltHtmlAndHeaders({
      indexHtml,
      headers,
      customHttpYaml: rootCustomHttpYaml,
      expectedConfig: publicConfig,
    });
    if (rootCustomHttpYaml !== expectedActiveYaml) {
      throw new Error(
        'Repository root customHttp.yml does not match the active environment security headers. Run "pnpm security:sync" before "pnpm security:check --require-root-match" in deployment builds.',
      );
    }
    return { publicConfig, headers };
  }

  const templateConfig = loadPublicConfig(TEMPLATE_ENV);
  const expectedTemplateYaml = renderCustomHttpYaml(templateConfig);

  if (
    rootCustomHttpYaml !== expectedActiveYaml &&
    rootCustomHttpYaml !== expectedTemplateYaml
  ) {
    throw new Error(
      'Repository root customHttp.yml matches neither the active PublicConfig nor the canonical security header template.',
    );
  }

  const rootTargetConfig =
    rootCustomHttpYaml === expectedActiveYaml ? publicConfig : templateConfig;
  validateBuiltHtmlAndHeaders({
    indexHtml,
    headers: buildSecurityHeaders(rootTargetConfig),
    customHttpYaml: rootCustomHttpYaml,
    expectedConfig: rootTargetConfig,
  });

  return { publicConfig, headers };
}

const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = process.argv.slice(2);
  const syncMode = args.includes('--sync-root');
  const requireRootMatchActiveConfig =
    syncMode || args.includes('--require-root-match');

  try {
    if (syncMode) {
      const { publicConfig } = syncCustomHttpFiles();
      console.log(
        `[security:sync] Synchronized customHttp.yml for VITE_APP_ENV=${publicConfig.appEnv} (${new URL(publicConfig.apiBaseUrl).origin}, ${new URL(publicConfig.realtimeUrl).origin}).`,
      );
    } else {
      runSecurityBuildCheck({ requireRootMatchActiveConfig });
      console.log(
        '[security:check] Passed: dist/index.html has no inline scripts and customHttp.yml enforces strict CSP and security headers.',
      );
    }
  } catch (error) {
    console.error(
      `[${syncMode ? 'security:sync' : 'security:check'}] ERROR:`,
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
