/// <reference types="vite/client" />
import { z } from 'zod';

export const PUBLIC_CONFIG_VARIABLES = [
  'VITE_APP_ENV',
  'VITE_API_BASE_URL',
  'VITE_REALTIME_URL',
] as const;

export type PublicConfigVariable = (typeof PUBLIC_CONFIG_VARIABLES)[number];

export const APP_ENVIRONMENTS = ['development', 'test', 'production'] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

/**
 * Typed, validated build-time public configuration for the browser bundle.
 * Only non-secret `VITE_` values may appear in this contract.
 */
export interface PublicConfig {
  readonly appEnv: AppEnvironment;
  readonly apiBaseUrl: string;
  readonly realtimeUrl: string;
}

export interface ConfigIssue {
  readonly variable: string;
  readonly message: string;
}

/**
 * Thrown when build-time or startup public configuration is missing or invalid.
 * Lists every offending variable by name and never echoes raw values.
 */
export class ConfigValidationError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    super(
      [
        'Invalid public configuration. Fix the following environment variables:',
        ...issues.map((issue) => `  - ${issue.variable}: ${issue.message}`),
      ].join('\n'),
    );
    this.name = 'ConfigValidationError';
    this.issues = Object.freeze([...issues]);
  }
}

const API_URL_MESSAGE =
  'must be an absolute http(s) URL without credentials, query string, hash, or trailing slash';
const REALTIME_URL_MESSAGE =
  'must be an absolute ws(s) URL without credentials, query string, hash, or trailing slash';
const PRODUCTION_API_HTTPS_MESSAGE =
  'must use https:// when VITE_APP_ENV is production';
const PRODUCTION_REALTIME_WSS_MESSAGE =
  'must use wss:// when VITE_APP_ENV is production';

const isValidEndpointUrl = (
  value: string,
  allowedProtocols: readonly string[],
): boolean => {
  if (value.endsWith('/')) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      allowedProtocols.includes(url.protocol) &&
      url.hostname !== '' &&
      url.username === '' &&
      url.password === '' &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
};

const envSchema = z
  .object({
    VITE_APP_ENV: z.enum(APP_ENVIRONMENTS, {
      error: (issue) =>
        issue.input === undefined
          ? 'is required'
          : `must be one of: ${APP_ENVIRONMENTS.join(', ')}`,
    }),
    VITE_API_BASE_URL: z
      .string({
        error: (issue) =>
          issue.input === undefined ? 'is required' : API_URL_MESSAGE,
      })
      .refine(
        (value) => isValidEndpointUrl(value, ['http:', 'https:']),
        API_URL_MESSAGE,
      ),
    VITE_REALTIME_URL: z
      .string({
        error: (issue) =>
          issue.input === undefined ? 'is required' : REALTIME_URL_MESSAGE,
      })
      .refine(
        (value) => isValidEndpointUrl(value, ['ws:', 'wss:']),
        REALTIME_URL_MESSAGE,
      ),
  })
  .superRefine((values, ctx) => {
    if (values.VITE_APP_ENV === 'production') {
      if (!values.VITE_API_BASE_URL.startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: ['VITE_API_BASE_URL'],
          message: PRODUCTION_API_HTTPS_MESSAGE,
        });
      }
      if (!values.VITE_REALTIME_URL.startsWith('wss://')) {
        ctx.addIssue({
          code: 'custom',
          path: ['VITE_REALTIME_URL'],
          message: PRODUCTION_REALTIME_WSS_MESSAGE,
        });
      }
    }
  });

type RawEnv = Record<string, unknown>;

/**
 * Blank strings are treated as unset so `VITE_FOO=` behaves like a missing variable.
 * Surrounding whitespace on valid strings is trimmed before validation.
 */
const normalizeEnv = (env: RawEnv): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {};
  for (const key of PUBLIC_CONFIG_VARIABLES) {
    const raw = env[key];
    if (raw === undefined) {
      continue;
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed !== '') {
        normalized[key] = trimmed;
      }
      continue;
    }
    normalized[key] = raw;
  }
  return normalized;
};

/**
 * Pure and side-effect free: validates `env` and returns a frozen `PublicConfig`
 * or throws `ConfigValidationError` naming every missing or invalid variable.
 */
export function loadPublicConfig(env: RawEnv): PublicConfig {
  const result = envSchema.safeParse(normalizeEnv(env));

  if (!result.success) {
    const seen = new Set<string>();
    const issues: ConfigIssue[] = [];
    for (const issue of result.error.issues) {
      const variable = String(issue.path[0] ?? 'environment');
      if (!seen.has(variable)) {
        seen.add(variable);
        issues.push({ variable, message: issue.message });
      }
    }
    throw new ConfigValidationError(issues);
  }

  return Object.freeze({
    appEnv: result.data.VITE_APP_ENV,
    apiBaseUrl: result.data.VITE_API_BASE_URL,
    realtimeUrl: result.data.VITE_REALTIME_URL,
  });
}

/**
 * Reads and validates the application's public configuration from `import.meta.env`.
 */
export function getPublicConfig(): PublicConfig {
  return loadPublicConfig(import.meta.env);
}
