import type { Middleware } from 'openapi-fetch';
import { mapNetworkError } from '../api/errors';
import { safeSessionError } from './transport';

export interface SessionMiddlewarePort {
  epoch(): number;
  signal(): AbortSignal;
  access(): string | undefined;
  revision(): number;
  expired(): boolean;
  renew(epoch: number, sentRevision: number): Promise<void>;
  invalidate(): void;
}
export function assertSessionEpoch(
  port: Pick<SessionMiddlewarePort, 'epoch'>,
  epoch: number,
): void {
  if (epoch !== port.epoch())
    throw new DOMException('Session changed', 'AbortError');
}
interface RequestContext {
  epoch: number;
  access?: string;
  renewed: boolean;
  revision: number;
  protected: boolean;
}

export function createSessionMiddleware(
  port: SessionMiddlewarePort,
  baseUrl: string,
): Middleware {
  const contexts = new WeakMap<Request, RequestContext>();
  const origin = new URL(baseUrl).origin;
  return {
    async onRequest({ request, schemaPath }) {
      // Reject rather than silently forwarding a caller-supplied Authorization header.
      if (new URL(request.url).origin !== origin) throw safeSessionError();
      const context: RequestContext = {
        epoch: port.epoch(),
        renewed: false,
        revision: port.revision(),
        protected:
          !schemaPath.startsWith('/auth/') || schemaPath === '/auth/logout',
      };
      if (context.protected && port.expired()) {
        await port.renew(context.epoch, context.revision);
        context.renewed = true;
      }
      assertSessionEpoch(port, context.epoch);
      request.headers.delete('Authorization');
      context.revision = port.revision();
      context.access = context.protected ? port.access() : undefined;
      if (context.access)
        request.headers.set('Authorization', `Bearer ${context.access}`);
      const secured = new Request(request, {
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.any([request.signal, port.signal()]),
      });
      contexts.set(secured, context);
      return secured;
    },
    async onResponse({ request, response, options }) {
      const context = contexts.get(request);
      if (!context) throw safeSessionError();
      assertSessionEpoch(port, context.epoch);
      let result = response;
      if (context.protected && response.status === 401 && context.access) {
        if (!context.renewed) {
          await port.renew(context.epoch, context.revision);
          context.renewed = true;
          assertSessionEpoch(port, context.epoch);
          if (request.method === 'GET' || request.method === 'HEAD') {
            const replay = new Request(request);
            replay.headers.set('Authorization', `Bearer ${port.access()}`);
            try {
              result = await options.fetch(replay);
            } catch {
              assertSessionEpoch(port, context.epoch);
              throw mapNetworkError(undefined);
            }
          }
        }
      }
      // Buffer BEFORE the last epoch check: headers alone do not fence a slow body.
      const body = result.body === null ? null : await result.arrayBuffer();
      assertSessionEpoch(port, context.epoch);
      if (context.protected && result.status === 401) port.invalidate();
      return new Response(body, {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
      });
    },
    onError({ request }) {
      const context = contexts.get(request);
      if (context) assertSessionEpoch(port, context.epoch);
      return mapNetworkError(undefined);
    },
  };
}
