import { expect, test } from 'vitest';
import { buildLoginRedirect, readReturnTarget } from './return-target';

const hostile = [
  '//evil.example',
  'https://evil.example',
  'javascript:alert(1)',
  '/\\evil.example',
  '/classroom',
  '',
];

test('builds a login redirect that carries the approved return location', () => {
  expect(buildLoginRedirect({ pathname: '/', search: '', hash: '' })).toBe(
    '/login?next=%2F',
  );
});

test('never forwards a location the session policy does not approve', () => {
  for (const pathname of hostile) {
    const url = buildLoginRedirect({ pathname, search: '?a=1', hash: '#b' });
    expect(url, pathname).toBe('/login?next=%2F');
  }
});

test('reads the return target through the session redirect policy', () => {
  expect(readReturnTarget(new URLSearchParams('next=%2F'))).toBe('/');
  expect(readReturnTarget(new URLSearchParams(''))).toBe('/');
  for (const value of hostile) {
    const params = new URLSearchParams({ next: value });
    expect(readReturnTarget(params), value).toBe('/');
  }
});

test('ignores repeated next parameters instead of picking an attacker value', () => {
  const params = new URLSearchParams('next=%2F&next=%2F%2Fevil.example');
  expect(readReturnTarget(params)).toBe('/');
});

// Production approves only "/" today; the policy accepts an allowlist so the
// forwarding path can be proven with a destination a later story will add.
const withClassrooms: ReadonlySet<string> = new Set(['/', '/classrooms']);

test('forwards an approved non-default destination through the login round trip', () => {
  const url = buildLoginRedirect(
    { pathname: '/classrooms', search: '', hash: '' },
    withClassrooms,
  );
  expect(url).toBe('/login?next=%2Fclassrooms');

  const params = new URL(url, 'https://app.example').searchParams;
  expect(readReturnTarget(params, withClassrooms)).toBe('/classrooms');
});

test('the production allowlist still degrades a non-default destination to "/"', () => {
  expect(
    buildLoginRedirect({ pathname: '/classrooms', search: '', hash: '' }),
  ).toBe('/login?next=%2F');
  expect(readReturnTarget(new URLSearchParams('next=%2Fclassrooms'))).toBe('/');
});

test('repeated next parameters are absent even when each value is approved', () => {
  const params = new URLSearchParams('next=%2Fclassrooms&next=%2Fclassrooms');
  expect(readReturnTarget(params, withClassrooms)).toBe('/');
});
