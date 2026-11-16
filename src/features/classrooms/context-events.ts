/** B is an invalidation hint, never an authoritative context or replay log. */
export async function readContextEvents(
  stream: ReadableStream<Uint8Array>,
  classroomId: string,
  onInvalidated: () => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let event = '';
  let data: string[] = [];
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  function line(value: string) {
    if (value === '') {
      if (event === 'classroom.context-invalidated') {
        const hint: unknown = JSON.parse(data.join('\n'));
        if (
          typeof hint !== 'object' ||
          hint === null ||
          !('classroomId' in hint) ||
          hint.classroomId !== classroomId
        ) {
          throw new Error('Invalid classroom context hint.');
        }
        if (!signal.aborted) onInvalidated();
      }
      event = '';
      data = [];
    } else if (!value.startsWith(':')) {
      const colon = value.indexOf(':');
      const field = colon < 0 ? value : value.slice(0, colon);
      const content = colon < 0 ? '' : value.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') event = content;
      if (field === 'data') data.push(content);
    }
  }
  try {
    if (signal.aborted) return;
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) return; // Incomplete EOF frames are discarded; owner reloads REST.
      pending += decoder.decode(value, { stream: true });
      if (pending.length + data.join('').length > 65_536)
        throw new Error('Context event frame exceeds limit.');
      let match: RegExpExecArray | null;
      while ((match = /\r\n|\r|\n/.exec(pending))) {
        if (match[0] === '\r' && match.index === pending.length - 1) break;
        line(pending.slice(0, match.index));
        pending = pending.slice(match.index + match[0].length);
      }
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
