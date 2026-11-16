import { expect, test, vi } from 'vitest';
import { readContextEvents } from './context-events';

const frame =
  'event: classroom.context-invalidated\ndata: {"classroomId":"a"}\n\n';

test.each(['\n', '\r\n', '\r'])(
  'parses byte-chunked %j frames, comments, duplicates and unknown fields without replay semantics',
  async (ending) => {
    const text = (
      ': heartbeat é\n\nevent: other\ndata: ignored\n\nid: ignored\n' +
      frame +
      frame
    ).replaceAll('\n', ending);
    const bytes = new TextEncoder().encode(text);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        // A following byte disambiguates the final CR as a complete delimiter.
        controller.enqueue(new TextEncoder().encode(':'));
        controller.close();
      },
    });
    const hint = vi.fn();
    await readContextEvents(stream, 'a', hint, new AbortController().signal);
    expect(hint).toHaveBeenCalledTimes(2);
  },
);

test('EOF discards an incomplete frame; a cancelled reader cannot emit a hint', async () => {
  const hint = vi.fn();
  const cancel = vi.fn();
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      source = controller;
    },
    cancel,
  });
  const abort = new AbortController();
  const reading = readContextEvents(stream, 'a', hint, abort.signal);
  source.enqueue(new TextEncoder().encode(frame.slice(0, -1)));
  abort.abort();
  await reading;
  expect(hint).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
});

test.each(['{"classroomId":"b"}', 'null', '{broken'])(
  'rejects malformed or foreign hints %s and releases the reader',
  async (data) => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `event: classroom.context-invalidated\ndata: ${data}\n\n`,
          ),
        );
      },
    });
    const hint = vi.fn();
    await expect(
      readContextEvents(stream, 'a', hint, new AbortController().signal),
    ).rejects.toThrow();
    expect(hint).not.toHaveBeenCalled();
    expect(stream.locked).toBe(false);
  },
);
