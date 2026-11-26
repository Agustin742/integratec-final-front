import { describe, expect, it, vi } from 'vitest';
import { captureMicrophone, MicCaptureError } from './mic-capture';

function devices(impl: () => Promise<unknown>) {
  return { getUserMedia: vi.fn(impl) } as unknown as MediaDevices;
}

describe('captureMicrophone (#141)', () => {
  it('requests audio only with echo cancellation, noise suppression and AGC', async () => {
    const stream = {};
    const mediaDevices = devices(async () => stream);
    await expect(
      captureMicrophone({ mediaDevices, isSecureContext: true }),
    ).resolves.toBe(stream);
    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  });

  it('fails with insecure-context before asking the browser', async () => {
    const mediaDevices = devices(async () => ({}));
    await expect(
      captureMicrophone({ mediaDevices, isSecureContext: false }),
    ).rejects.toMatchObject({ code: 'insecure-context' });
    expect(mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('fails with unsupported when the browser has no media devices', async () => {
    await expect(
      captureMicrophone({ mediaDevices: undefined, isSecureContext: true }),
    ).rejects.toMatchObject({ code: 'unsupported' });
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['NotReadableError', 'unknown'],
  ])('maps %s to %s', async (name, code) => {
    const mediaDevices = devices(async () => {
      throw new DOMException('x', name);
    });
    const error = await captureMicrophone({
      mediaDevices,
      isSecureContext: true,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MicCaptureError);
    expect((error as MicCaptureError).code).toBe(code);
  });
});
