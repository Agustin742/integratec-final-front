import { isRouteErrorResponse } from 'react-router';
import { ApiError } from '@/api/errors';

/**
 * How a route-level failure is presented. Only the kind decides the view; the
 * error itself (message, stack, server data) is never rendered.
 */
export type RouteErrorKind =
  'not-found' | 'forbidden' | 'stale-chunk' | 'unexpected';

/**
 * Typed error a page, hook or loader throws to show the not-found or forbidden
 * view. A class is used instead of `data(null, { status })` because
 * react-router only wraps thrown responses that come from loaders and actions;
 * an error thrown while rendering reaches the boundary untouched. A class works
 * from both places.
 */
class RouteAccessError extends Error {
  readonly kind: 'not-found' | 'forbidden';

  constructor(kind: 'not-found' | 'forbidden') {
    super(kind);
    this.name = 'RouteAccessError';
    this.kind = kind;
  }
}

/** `throw notFound()`: the resource does not exist or is not visible to the user. */
export const notFound = (): Error => new RouteAccessError('not-found');

/** `throw forbidden()`: a reachable resource the user's role cannot use. */
export const forbidden = (): Error => new RouteAccessError('forbidden');

// Browser wording for a failed dynamic import (Chromium, Firefox, Safari), the
// webpack-style chunk error and Vite's CSS preload failure.
const STALE_CHUNK_PATTERN =
  /dynamically imported module|importing a module script failed|unable to preload css|loading chunk .* failed/i;

/**
 * A lazy route chunk that cannot be fetched, typically after a deploy replaced
 * the hashed files or the network dropped. Retrying the import cannot help;
 * only a fresh `index.html` can.
 */
export function isStaleChunkError(error: unknown): boolean {
  return error instanceof Error && STALE_CHUNK_PATTERN.test(error.message);
}

/**
 * Maps whatever a route threw to a presentation kind.
 *
 * 404 means "not found" and 403 means "not allowed", whether it arrives as a
 * router error response, an `ApiError` or a typed helper. A 401 is deliberately
 * not mapped: the session layer owns it, and a boundary must never send the
 * user to login.
 */
export function classifyRouteError(error: unknown): RouteErrorKind {
  if (error instanceof RouteAccessError) return error.kind;
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return 'not-found';
    if (error.status === 403) return 'forbidden';
    return 'unexpected';
  }
  if (error instanceof ApiError) {
    if (error.kind === 'not-found') return 'not-found';
    if (error.kind === 'forbidden') return 'forbidden';
    return 'unexpected';
  }
  if (isStaleChunkError(error)) return 'stale-chunk';
  return 'unexpected';
}
