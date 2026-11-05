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

export default defineConfig({
  plugins: [validatePublicConfigPlugin(), react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
