import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { requestApi } from '@/api/client';
import { ApiError } from '@/api/errors';
import { classroomDetailQueryKey } from '@/api/query-keys';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { readContextEvents } from './context-events';

/** One workspace owner, not one subscription per capability consumer. */
export function useClassroomContextEvents(classroomId: string): void {
  const { client, controller } = useSessionService();
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;
  const queryClient = useQueryClient();
  useEffect(() => {
    if (userId === null) return;
    const queryKey = classroomDetailQueryKey(userId, classroomId);
    let stopped = false;
    let connection: AbortController | undefined;
    let renewal: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = 1_000;
    const reload = () => {
      if (stopped) return;
      // Reset cancels obsolete REST, removes private data for ALL observers,
      // then fetches the same authoritative query. No parallel context store.
      void queryClient.resetQueries({ queryKey, exact: true });
    };
    const stop = () => {
      stopped = true;
      connection?.abort();
      clearTimeout(renewal);
      clearTimeout(retry);
    };
    const unregister = controller.registerCleanup(stop);
    async function connect() {
      if (stopped) return;
      connection = new AbortController();
      const signal = connection.signal;
      renewal = setTimeout(() => connection?.abort(), 60_000);
      let terminal = false;
      try {
        const stream = await requestApi(() =>
          client
            .GET('/classrooms/{id}/context-events', {
              params: { path: { id: classroomId } },
              headers: { Accept: 'text/event-stream' },
              parseAs: 'stream',
              signal,
            })
            .then((result) => {
              if (
                result.response.ok &&
                result.response.headers
                  .get('content-type')
                  ?.split(';')[0]
                  .trim()
                  .toLowerCase() !== 'text/event-stream'
              ) {
                void result.data?.cancel();
                throw new Error('Expected classroom context event stream.');
              }
              return result;
            }),
        );
        if (!stream) throw new Error('Missing classroom context stream.');
        if (stopped || signal.aborted) {
          await stream.cancel();
          return;
        }
        reload(); // Register first, then reconcile: no connection/read gap.
        await readContextEvents(stream, classroomId, reload, signal);
      } catch (error) {
        // Authentication recovery belongs exclusively to client middleware.
        terminal =
          error instanceof ApiError &&
          (error.status === 401 ||
            error.status === 403 ||
            error.status === 404);
      } finally {
        clearTimeout(renewal);
        connection?.abort();
        if (!stopped) {
          reload(); // EOF, renewal, setup or framing failure all reconcile.
          if (!terminal) {
            retry = setTimeout(() => {
              void connect();
            }, delay);
            delay = Math.min(delay * 2, 30_000);
          }
        }
      }
    }
    void connect();
    return () => {
      stop();
      unregister();
    };
  }, [classroomId, client, controller, queryClient, userId]);
}
