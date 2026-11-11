import { vi } from 'vitest';
import type { components } from '../api/schema.generated';

export const baseUrl = 'https://api.example.invalid';
export const storageKey = 'integratec.session';
export const tokens: components['schemas']['TokenPairResponseDto'] = {
  accessToken: 'synthetic-access',
  refreshToken: 'synthetic-refresh',
  tokenType: 'Bearer',
  expiresIn: 900,
};
export const rotated = {
  ...tokens,
  accessToken: 'next-access',
  refreshToken: 'next-refresh',
};
export const profile: components['schemas']['OwnProfileDto'] = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'learner@example.test',
  displayName: 'Synthetic Learner',
  avatar: {
    bodyId: 'male',
    hairId: 'afro',
    topId: 'hoodie',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};
export const login = {
  email: 'learner@example.test',
  password: 'synthetic-password',
};
export const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status });
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
export function memoryStorage(raw?: string) {
  const entries = new Map<string, string>(
    raw === undefined ? [] : [[storageKey, raw]],
  );
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
}
export function harness(
  handler?: (request: Request) => Response | Promise<Response>,
  raw?: string,
) {
  const storage = memoryStorage(raw);
  const requests: Request[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    if (handler) return handler(request);
    if (request.url.endsWith('/users/me')) return json(profile);
    if (request.url.endsWith('/auth/logout'))
      return new Response(null, { status: 204 });
    return json(tokens);
  });
  return { storage, requests, fetch, baseUrl };
}
export const saved = (expiresAt = Date.now() + 900_000): string =>
  JSON.stringify({ ...tokens, expiresAt });
