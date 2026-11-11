import { safeSessionRedirect } from '@/session/redirect';

export const LOGIN_PATH = '/login';
export const RETURN_TARGET_PARAM = 'next';

type LocationLike = { pathname: string; search: string; hash: string };

/**
 * Login URL that remembers where the visitor was heading. The location goes
 * through the session redirect policy before it is written, so a value the
 * policy does not approve degrades to the default destination.
 */
export function buildLoginRedirect(location: LocationLike): string {
  const target = safeSessionRedirect(
    `${location.pathname}${location.search}${location.hash}`,
  );
  const params = new URLSearchParams({ [RETURN_TARGET_PARAM]: target });
  return `${LOGIN_PATH}?${params.toString()}`;
}

/**
 * The query string is attacker-controlled, so it is re-validated on read.
 * Repeated parameters are treated as absent rather than picking one.
 */
export function readReturnTarget(searchParams: URLSearchParams): string {
  const values = searchParams.getAll(RETURN_TARGET_PARAM);
  return safeSessionRedirect(values.length === 1 ? values[0] : undefined);
}
