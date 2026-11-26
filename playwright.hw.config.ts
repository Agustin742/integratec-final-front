import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  projects: (baseConfig.projects ?? []).map((project) => ({
    ...project,
    use: {
      ...project.use,
      launchOptions: {
        ...project.use?.launchOptions,
        args: [...(project.use?.launchOptions?.args ?? []), '--use-angle=d3d11'],
      },
    },
  })),
});
