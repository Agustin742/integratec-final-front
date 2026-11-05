import createClient, { type Client } from 'openapi-fetch';
import { getPublicConfig } from '../config/public-config';
import { mapApiError, mapNetworkError } from './errors';
import type { paths } from './schema.generated';

export type TypedApiClient = Client<paths>;

export interface CreateApiClientOptions {
  readonly baseUrl?: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly headers?: HeadersInit;
}

/**
 * Creates a typed `openapi-fetch` client bound to the generated `paths` contract
 * (`src/api/schema.generated.ts`) and the validated `VITE_API_BASE_URL` from F05.
 */
export function createApiClient(
  options: CreateApiClientOptions = {},
): TypedApiClient {
  const baseUrl = options.baseUrl ?? getPublicConfig().apiBaseUrl;
  return createClient<paths>({
    baseUrl,
    fetch: options.fetch,
    headers: options.headers,
  });
}

export interface OpenApiFetchResult<TData> {
  readonly data?: TData;
  readonly error?: unknown;
  readonly response: Response;
}

/**
 * Executes an `openapi-fetch` request callback, returning the typed `data` on
 * success or throwing a mapped `ApiError` on HTTP or network failure.
 */
export async function requestApi<TData>(
  execute: () => Promise<OpenApiFetchResult<TData>>,
): Promise<TData> {
  let result: OpenApiFetchResult<TData>;
  try {
    result = await execute();
  } catch (cause) {
    throw mapNetworkError(cause);
  }

  if (result.error !== undefined || !result.response.ok) {
    throw mapApiError(result.error, result.response);
  }

  if (result.data === undefined) {
    return undefined as TData;
  }

  return result.data;
}
