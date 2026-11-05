import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import {
  PUBLIC_CONFIG_VARIABLES,
  loadPublicConfig,
} from './src/config/public-config.ts';

function validatePublicConfigPlugin(): Plugin {
  return {
    name: 'validate-public-config',
    configResolved(config) {
      if (
        config.mode === 'test' ||
        Boolean(process.env.VITEST) ||
        process.argv.includes('preview')
      ) {
        return;
      }
      const loaded = loadEnv(config.mode, config.root, 'VITE_');
      const merged: Record<string, unknown> = { ...loaded };
      for (const variable of PUBLIC_CONFIG_VARIABLES) {
        if (process.env[variable] !== undefined) {
          merged[variable] = process.env[variable];
        }
      }
      loadPublicConfig(merged);
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
