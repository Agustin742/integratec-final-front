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

const TAB_NAME_MARKER = '\n[integratec-tab:';

/** Nonsecret continuity hint only; never an authentication/authorization claim. */
function browserTabOwner(): string {
  const name = window.name;
  const match = /\n\[integratec-tab:([0-9a-f-]{36})\]$/.exec(name);
  if (match) return match[1];
  const nonce = globalThis.crypto.randomUUID();
  // Preserve unrelated targeting names rather than replacing them with a token.
  const next = `${name}${TAB_NAME_MARKER}${nonce}]`;
  window.name = next;
  if (window.name !== next) throw new Error('Tab ownership unavailable');
  return nonce;
}

export function createSessionStorage(
  injected?: SessionStorage,
  tabOwner?: () => string | undefined,
) {
  // Memory adapters have no implicit browser dependencies. Explicit owners model tabs.
  const owned = tabOwner !== undefined || injected === undefined;
  let owner: string | undefined;
  if (owned) {
    try {
      owner = (tabOwner ?? browserTabOwner)();
      if (!owner) owner = undefined;
    } catch {
      // Ownership failure must discard persisted credentials before any API call.
    }
  }
  const ownerUnavailable = owned && owner === undefined;
  const getStorage = (): SessionStorage =>
    injected ?? globalThis.sessionStorage;
  const clear = (): boolean => {
    try {
      getStorage().removeItem(SESSION_STORAGE_KEY);
      return !ownerUnavailable;
    } catch {
      return false;
    }
  };
  return {
    clear,
    read(): { credentials?: StoredCredentials; unavailable: boolean } {
      if (ownerUnavailable) {
        clear();
        return { unavailable: true };
      }
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
        const metadata = z.object({ tabOwner: z.string() }).safeParse(payload);
        if (
          result.success &&
          (!owned || (metadata.success && metadata.data.tabOwner === owner))
        )
          return { credentials: result.data, unavailable: false };
      } catch {
        // Malformed JSON is not a session.
      }
      return { unavailable: !clear() };
    },
    write(credentials: StoredCredentials): boolean {
      if (ownerUnavailable) {
        clear();
        return false;
      }
      try {
        getStorage().setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify(
            owned ? { ...credentials, tabOwner: owner } : credentials,
          ),
        );
        return true;
      } catch {
        clear();
        return false;
      }
    },
  };
}
