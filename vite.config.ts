import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin, type ResolvedConfig } from 'vite';
import {
  PUBLIC_CONFIG_VARIABLES,
  loadPublicConfig,
  type PublicConfig,
} from './src/config/public-config.ts';
import {
  buildSecurityHeaders,
  renderCustomHttpYaml,
  validateBuiltHtmlAndHeaders,
} from './src/config/security-headers.ts';

function resolveEnvConfig(
  mode: string,
  root: string,
  allowPreviewDefaults: boolean,
): PublicConfig {
  const loaded = loadEnv(mode, root, 'VITE_');
  const merged: Record<string, unknown> = { ...loaded };
  for (const variable of PUBLIC_CONFIG_VARIABLES) {
    if (process.env[variable] !== undefined) {
      merged[variable] = process.env[variable];
    }
  }
  if (allowPreviewDefaults) {
    merged.VITE_APP_ENV ??= 'test';
    merged.VITE_API_BASE_URL ??= 'https://api.example.invalid';
    merged.VITE_REALTIME_URL ??= 'wss://realtime.example.invalid';
  }
  return loadPublicConfig(merged);
}

function validatePublicConfigPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | null = null;
  let publicConfig: PublicConfig | null = null;

  return {
    name: 'validate-public-config-and-security-headers',
    configResolved(config) {
      resolvedConfig = config;
      const isVitest = config.mode === 'test' || Boolean(process.env.VITEST);
      if (isVitest) {
        return;
      }
      const isPreview = process.argv.includes('preview');
      publicConfig = resolveEnvConfig(config.mode, config.root, isPreview);
    },
    configurePreviewServer(server) {
      const config =
        publicConfig ??
        resolveEnvConfig(
          resolvedConfig?.mode ?? 'production',
          resolvedConfig?.root ?? process.cwd(),
          true,
        );
      const headers = buildSecurityHeaders(config);
      server.middlewares.use((_req, res, next) => {
        for (const [key, value] of Object.entries(headers)) {
          res.setHeader(key, value);
        }
        next();
      });
    },
    closeBundle() {
      if (
        !resolvedConfig ||
        resolvedConfig.command !== 'build' ||
        !publicConfig
      ) {
        return;
      }
      const outDir = resolve(resolvedConfig.root, resolvedConfig.build.outDir);
      const indexHtmlPath = resolve(outDir, 'index.html');
      const customHttpPath = resolve(outDir, 'customHttp.yml');
      const indexHtml = readFileSync(indexHtmlPath, 'utf8');
      const headers = buildSecurityHeaders(publicConfig);
      const customHttpYaml = renderCustomHttpYaml(publicConfig);

      writeFileSync(customHttpPath, customHttpYaml, 'utf8');
      validateBuiltHtmlAndHeaders({
        indexHtml,
        headers,
        customHttpYaml,
      });
    },
  };
}

export default defineConfig(({ command, mode }) => ({
  define: {
    // The showcase is a development aid: served by the dev server and by the
    // `showcase` build mode the browser suite runs against, never shipped in a
    // production build. The constant is replaced at build time so the unused
    // lazy chunk is dropped.
    __UI_SHOWCASE__: JSON.stringify(command === 'serve' || mode === 'showcase'),
  },
  plugins: [validatePublicConfigPlugin(), react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
}));
