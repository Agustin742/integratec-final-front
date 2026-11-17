import { safeSessionRedirect } from '@/session/redirect';

export const LOGIN_PATH = '/login';
export const REGISTER_PATH = '/register';
export const PASSWORD_RESET_PATH = '/password-reset';
export const RETURN_TARGET_PARAM = 'next';

type LocationLike = { pathname: string; search: string; hash: string };

/**
 * Login URL that remembers where the visitor was heading. The location goes
 * through the session redirect policy before it is written, so a value the
 * policy does not approve degrades to the default destination. `approved` is a
 * test seam only; the application always uses the production allowlist.
 */
export function buildLoginRedirect(
  location: LocationLike,
  approved?: ReadonlySet<string>,
): string {
  const target = safeSessionRedirect(
    `${location.pathname}${location.search}${location.hash}`,
    approved,
  );
  const params = new URLSearchParams({ [RETURN_TARGET_PARAM]: target });
  return `${LOGIN_PATH}?${params.toString()}`;
}

/**
 * The query string is attacker-controlled, so it is re-validated on read.
 * Repeated parameters are treated as absent rather than picking one.
 */
export function readReturnTarget(
  searchParams: URLSearchParams,
  approved?: ReadonlySet<string>,
): string {
  const values = searchParams.getAll(RETURN_TARGET_PARAM);
  return safeSessionRedirect(
    values.length === 1 ? values[0] : undefined,
    approved,
  );
}

/**
 * Reports whether `?next=` carries a single destination explicitly approved by
 * the session redirect policy. Used to show return-context hints without
 * trusting tampered or repeated query parameters.
 */
export function hasValidReturnTarget(
  searchParams: URLSearchParams,
  approved?: ReadonlySet<string>,
): boolean {
  const values = searchParams.getAll(RETURN_TARGET_PARAM);
  return (
    values.length === 1 &&
    safeSessionRedirect(values[0], approved) === values[0]
  );
}

/**
 * Builds an auth sibling route href (for example `/register` or `/password-reset`)
 * carrying `?next=` only when the current query string contains a single approved target.
 */
export function buildAuthReturnHref(
  pathname: string,
  searchParams: URLSearchParams,
  approved?: ReadonlySet<string>,
): string {
  if (!hasValidReturnTarget(searchParams, approved)) {
    return pathname;
  }
  const target = searchParams.get(RETURN_TARGET_PARAM)!;
  const nextParams = new URLSearchParams({
    [RETURN_TARGET_PARAM]: target,
  });
  return `${pathname}?${nextParams.toString()}`;
}
