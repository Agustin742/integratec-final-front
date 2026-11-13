import { expect, test } from 'vitest';
import { safeSessionRedirect } from './redirect';

test('accepts only the approved root destination without normalization', () => {
  expect(safeSessionRedirect('/')).toBe('/');
  for (const destination of [
    'https://evil.example',
    '//evil.example',
    '\\evil.example',
    '/\\evil.example',
    '%2f',
    '/%2f/evil.example',
    '/%5c',
    '/%252f',
    '/?next=//evil.example',
    '/#private',
    '/classroom',
    '/login',
    '/./',
    '/../',
    ' /',
    '/ ',
    'javascript:alert(1)',
    '',
    null,
    undefined,
    1,
    { toString: () => '/' },
  ]) {
    expect(safeSessionRedirect(destination), String(destination)).toBe('/');
  }
});

test('an explicit allowlist replaces the production one for that call only', () => {
  const allowlist: ReadonlySet<string> = new Set(['/classrooms']);
  expect(safeSessionRedirect('/classrooms', allowlist)).toBe('/classrooms');
  expect(safeSessionRedirect('/', allowlist)).toBe('/');
  expect(safeSessionRedirect('/classrooms')).toBe('/');
});
