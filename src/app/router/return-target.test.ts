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
