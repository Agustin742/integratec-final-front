import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  ConfigValidationError,
  PUBLIC_CONFIG_VARIABLES,
  getPublicConfig,
  loadPublicConfig,
} from './public-config';

const validDevelopmentEnv = {
  VITE_APP_ENV: 'development',
  VITE_API_BASE_URL: 'http://localhost:3000',
  VITE_REALTIME_URL: 'ws://localhost:2567',
};

describe('loadPublicConfig', () => {
  test('returns a frozen typed config for valid development values', () => {
    const config = loadPublicConfig(validDevelopmentEnv);

    expect(config).toEqual({
      appEnv: 'development',
      apiBaseUrl: 'http://localhost:3000',
      realtimeUrl: 'ws://localhost:2567',
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  test('accepts valid test and production configurations with secure protocols', () => {
    const testConfig = loadPublicConfig({
      VITE_APP_ENV: 'test',
      VITE_API_BASE_URL: 'https://api.test.example.invalid/v1',
      VITE_REALTIME_URL: 'wss://realtime.test.example.invalid',
    });
    expect(testConfig).toEqual({
      appEnv: 'test',
      apiBaseUrl: 'https://api.test.example.invalid/v1',
      realtimeUrl: 'wss://realtime.test.example.invalid',
    });

    const prodConfig = loadPublicConfig({
      VITE_APP_ENV: 'production',
      VITE_API_BASE_URL: 'https://api.example.invalid',
      VITE_REALTIME_URL: 'wss://realtime.example.invalid',
    });
    expect(prodConfig).toEqual({
      appEnv: 'production',
      apiBaseUrl: 'https://api.example.invalid',
      realtimeUrl: 'wss://realtime.example.invalid',
    });
  });

  test('trims surrounding whitespace on valid values and ignores unrelated properties', () => {
    const config = loadPublicConfig({
      VITE_APP_ENV: '  development  ',
      VITE_API_BASE_URL: '  http://localhost:3000  ',
      VITE_REALTIME_URL: '  ws://localhost:2567  ',
      MODE: 'development',
      BASE_URL: '/',
      PRIVATE_SECRET: 'should-never-be-read',
    });

    expect(config).toEqual({
      appEnv: 'development',
      apiBaseUrl: 'http://localhost:3000',
      realtimeUrl: 'ws://localhost:2567',
    });
    expect(Object.keys(config)).toEqual([
      'appEnv',
      'apiBaseUrl',
      'realtimeUrl',
    ]);
  });

  test('fails fast and names every missing variable when the environment is empty', () => {
    expect.assertions(5);
    try {
      loadPublicConfig({});
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      const validationError = error as ConfigValidationError;
      expect(validationError.issues).toEqual([
        { variable: 'VITE_APP_ENV', message: 'is required' },
        { variable: 'VITE_API_BASE_URL', message: 'is required' },
        { variable: 'VITE_REALTIME_URL', message: 'is required' },
      ]);
      for (const variable of PUBLIC_CONFIG_VARIABLES) {
        expect(validationError.message).toContain(`- ${variable}: is required`);
      }
    }
  });

  test.each(PUBLIC_CONFIG_VARIABLES)(
    'treats missing or blank %s as unset and names the variable',
    (variable) => {
      for (const emptyValue of [undefined, '', '   ']) {
        const env = { ...validDevelopmentEnv, [variable]: emptyValue };
        expect(() => loadPublicConfig(env)).toThrowError(
          new RegExp(`- ${variable}: is required`),
        );
      }
    },
  );

  test('rejects invalid VITE_APP_ENV values without echoing the invalid input', () => {
    const badValue = 'staging-secret-value';
    expect.assertions(3);
    try {
      loadPublicConfig({
        ...validDevelopmentEnv,
        VITE_APP_ENV: badValue,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      const validationError = error as ConfigValidationError;
      expect(validationError.message).toContain(
        '- VITE_APP_ENV: must be one of: development, test, production',
      );
      expect(validationError.message).not.toContain(badValue);
    }
  });

  test.each([
    ['not-a-url'],
    ['ftp://localhost:3000'],
    ['ws://localhost:3000'],
    ['http://localhost:3000/'],
    ['http://user:password@localhost:3000'],
    ['http://localhost:3000?token=secret'],
    ['http://localhost:3000#fragment'],
  ])('rejects malformed or unsafe VITE_API_BASE_URL (%s)', (badUrl) => {
    expect.assertions(2);
    try {
      loadPublicConfig({
        ...validDevelopmentEnv,
        VITE_API_BASE_URL: badUrl,
      });
    } catch (error) {
      const validationError = error as ConfigValidationError;
      expect(validationError.message).toContain(
        '- VITE_API_BASE_URL: must be an absolute http(s) URL without credentials, query string, hash, or trailing slash',
      );
      expect(validationError.message).not.toContain(badUrl);
    }
  });

  test.each([
    ['not-a-url'],
    ['http://localhost:2567'],
    ['https://localhost:2567'],
    ['ws://localhost:2567/'],
    ['ws://user:password@localhost:2567'],
    ['ws://localhost:2567?token=secret'],
    ['ws://localhost:2567#room'],
  ])('rejects malformed or unsafe VITE_REALTIME_URL (%s)', (badUrl) => {
    expect.assertions(2);
    try {
      loadPublicConfig({
        ...validDevelopmentEnv,
        VITE_REALTIME_URL: badUrl,
      });
    } catch (error) {
      const validationError = error as ConfigValidationError;
      expect(validationError.message).toContain(
        '- VITE_REALTIME_URL: must be an absolute ws(s) URL without credentials, query string, hash, or trailing slash',
      );
      expect(validationError.message).not.toContain(badUrl);
    }
  });

  test('enforces https:// and wss:// when VITE_APP_ENV is production', () => {
    expect.assertions(2);
    try {
      loadPublicConfig({
        VITE_APP_ENV: 'production',
        VITE_API_BASE_URL: 'http://api.example.invalid',
        VITE_REALTIME_URL: 'ws://realtime.example.invalid',
      });
    } catch (error) {
      const validationError = error as ConfigValidationError;
      expect(validationError.issues).toEqual([
        {
          variable: 'VITE_API_BASE_URL',
          message: 'must use https:// when VITE_APP_ENV is production',
        },
        {
          variable: 'VITE_REALTIME_URL',
          message: 'must use wss:// when VITE_APP_ENV is production',
        },
      ]);
      expect(validationError.message).not.toContain('api.example.invalid');
    }
  });
});

describe('getPublicConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('reads and validates import.meta.env', () => {
    vi.stubEnv('VITE_APP_ENV', 'development');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000');
    vi.stubEnv('VITE_REALTIME_URL', 'ws://localhost:2567');

    expect(getPublicConfig()).toEqual({
      appEnv: 'development',
      apiBaseUrl: 'http://localhost:3000',
      realtimeUrl: 'ws://localhost:2567',
    });
  });

  test('throws ConfigValidationError when import.meta.env is missing required values', () => {
    vi.stubEnv('VITE_APP_ENV', '');
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_REALTIME_URL', '');

    expect(() => getPublicConfig()).toThrowError(ConfigValidationError);
  });
});
