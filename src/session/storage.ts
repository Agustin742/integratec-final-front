import { z } from 'zod';
import type { components } from '../api/schema.generated';

export type TokenPair = components['schemas']['TokenPairResponseDto'];
export type SessionStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
>;
export const SESSION_STORAGE_KEY = 'integratec.session';
const credential = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9._~+/-]+=*$/);
export const tokenPairSchema = z.object({
  accessToken: credential,
  refreshToken: credential,
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive().finite(),
}) satisfies z.ZodType<TokenPair>;
const storedSchema = tokenPairSchema.extend({
  expiresAt: z.number().nonnegative().finite(),
});
export type StoredCredentials = z.infer<typeof storedSchema>;

export function createSessionStorage(injected?: SessionStorage) {
  const getStorage = (): SessionStorage =>
    injected ?? globalThis.sessionStorage;
  const clear = (): boolean => {
    try {
      getStorage().removeItem(SESSION_STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  };
  return {
    clear,
    read(): { credentials?: StoredCredentials; unavailable: boolean } {
      let raw: string | null;
      try {
        raw = getStorage().getItem(SESSION_STORAGE_KEY);
      } catch {
        return { unavailable: true };
      }
      if (raw === null) return { unavailable: false };
      try {
        const payload: unknown = JSON.parse(raw);
        const result = storedSchema.safeParse(payload);
        if (result.success)
          return { credentials: result.data, unavailable: false };
      } catch {
        // Malformed JSON is not a session.
      }
      return { unavailable: !clear() };
    },
    write(credentials: StoredCredentials): boolean {
      try {
        getStorage().setItem(SESSION_STORAGE_KEY, JSON.stringify(credentials));
        return true;
      } catch {
        clear();
        return false;
      }
    },
  };
}
