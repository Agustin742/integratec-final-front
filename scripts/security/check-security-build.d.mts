import type { PublicConfig } from '../../src/config/public-config.ts';
import type { SecurityHeaders } from '../../src/config/security-headers.ts';

export const TEMPLATE_ENV: Readonly<{
  VITE_APP_ENV: string;
  VITE_API_BASE_URL: string;
  VITE_REALTIME_URL: string;
}>;

export function resolveSecurityConfig(
  root?: string,
  envOverrides?: Record<string, unknown>,
): PublicConfig;

export function syncCustomHttpFiles(options?: {
  root?: string;
  env?: Record<string, unknown>;
}): {
  publicConfig: PublicConfig;
  yaml: string;
  rootCustomHttpPath: string;
};

export function runSecurityBuildCheck(options?: {
  root?: string;
  env?: Record<string, unknown>;
  requireRootMatchActiveConfig?: boolean;
}): {
  publicConfig: PublicConfig;
  headers: SecurityHeaders;
};
