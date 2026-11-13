import { data } from 'react-router';
import { describe, expect, test } from 'vitest';
import { ApiError, mapApiError } from '@/api/errors';
import {
  classifyRouteError,
  forbidden,
  isStaleChunkError,
  notFound,
} from './route-errors';

const apiError = (status: number) =>
  mapApiError({}, { status, headers: new Headers() });

describe('classifyRouteError', () => {
  test('maps the typed throw helpers', () => {
    expect(classifyRouteError(notFound())).toBe('not-found');
    expect(classifyRouteError(forbidden())).toBe('forbidden');
  });

  test('maps a 404/403 route error response from a loader', () => {
    // `isRouteErrorResponse` only accepts the router's own wrapper shape.
    const wrap = (status: number) => ({
      status,
      statusText: '',
      internal: false,
      data: null,
    });
    expect(classifyRouteError(wrap(404))).toBe('not-found');
    expect(classifyRouteError(wrap(403))).toBe('forbidden');
    expect(classifyRouteError(wrap(500))).toBe('unexpected');
    expect(classifyRouteError(data(null, { status: 404 }))).toBe('unexpected');
  });

  test('maps API errors without revealing foreign resources', () => {
    expect(classifyRouteError(apiError(404))).toBe('not-found');
    expect(classifyRouteError(apiError(403))).toBe('forbidden');
  });

  test('never classifies a 401 as access control: the session layer owns it', () => {
    expect(classifyRouteError(apiError(401))).toBe('unexpected');
  });

  test('maps network and unknown failures to a generic error', () => {
    expect(classifyRouteError(apiError(500))).toBe('unexpected');
    expect(classifyRouteError(new Error('boom'))).toBe('unexpected');
    expect(classifyRouteError('text')).toBe('unexpected');
    expect(classifyRouteError(undefined)).toBe('unexpected');
  });

  test('maps failed dynamic imports to a stale chunk', () => {
    expect(
      classifyRouteError(
        new TypeError('Failed to fetch dynamically imported module: /a.js'),
      ),
    ).toBe('stale-chunk');
  });
});

describe('isStaleChunkError', () => {
  test.each([
    'Failed to fetch dynamically imported module: https://x/a.js',
    'error loading dynamically imported module: https://x/a.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/a.css',
    'Loading chunk 12 failed.',
  ])('recognizes %s', (message) => {
    expect(isStaleChunkError(new TypeError(message))).toBe(true);
  });

  test('ignores unrelated errors', () => {
    expect(isStaleChunkError(new Error('Cannot read properties'))).toBe(false);
    expect(
      isStaleChunkError({ message: 'Importing a module script failed.' }),
    ).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });
});

test('thrown helpers are plain Errors, not API errors', () => {
  for (const error of [notFound(), forbidden()]) {
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ApiError);
  }
});
