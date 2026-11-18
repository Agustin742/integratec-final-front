import { expect, test } from 'vitest';
import { safeSessionRedirect } from './redirect';

test('accepts only approved destinations without unsafe normalization', () => {
  expect(safeSessionRedirect('/')).toBe('/');
  expect(safeSessionRedirect('/invitations/accept')).toBe(
    '/invitations/accept',
  );
  expect(
    safeSessionRedirect('/invitations/accept?token=inv_valid_token_123'),
  ).toBe('/invitations/accept?token=inv_valid_token_123');

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
    '/invitations/accept?',
    '/invitations/accept?token=',
    '/invitations/accept?token=a&token=b',
    '/invitations/accept?token=a&extra=1',
    '/invitations/accept?token=has%20space',
    '/invitations/accept?token=%61%62%63',
    '/invitations/accept?token=abc#frag',
    `/invitations/accept?token=${'a'.repeat(129)}`,
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
  expect(
    safeSessionRedirect('/invitations/accept?token=valid-token', allowlist),
  ).toBe('/');
  expect(safeSessionRedirect('/classrooms')).toBe('/');
});
