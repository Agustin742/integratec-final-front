export type MicCaptureErrorCode =
  'denied' | 'not-found' | 'insecure-context' | 'unsupported' | 'unknown';

export class MicCaptureError extends Error {
  readonly code: MicCaptureErrorCode;

  constructor(code: MicCaptureErrorCode, options?: { cause?: unknown }) {
    super(`Microphone capture failed: ${code}`, options);
    this.name = 'MicCaptureError';
    this.code = code;
  }
}

export interface MicCaptureEnvironment {
  readonly mediaDevices?: MediaDevices | undefined;
  readonly isSecureContext?: boolean | undefined;
}

function defaultEnvironment(): MicCaptureEnvironment {
  return {
    mediaDevices:
      typeof navigator === 'undefined' ? undefined : navigator.mediaDevices,
    isSecureContext:
      typeof window === 'undefined' ? undefined : window.isSecureContext,
  };
}

function errorName(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name: unknown }).name)
    : '';
}

function mapCaptureError(error: unknown): MicCaptureErrorCode {
  switch (errorName(error)) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'not-found';
    default:
      return 'unknown';
  }
}

/**
 * Opens the microphone for a voice call: audio only, with the browser's echo
 * cancellation, noise suppression and automatic gain. Failures are typed so the
 * UI can explain them; nothing here logs or exposes device identifiers.
 */
export async function captureMicrophone(
  environment: MicCaptureEnvironment = defaultEnvironment(),
): Promise<MediaStream> {
  if (environment.isSecureContext === false) {
    throw new MicCaptureError('insecure-context');
  }
  const mediaDevices = environment.mediaDevices;
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
    throw new MicCaptureError('unsupported');
  }
  try {
    return await mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch (error) {
    throw new MicCaptureError(mapCaptureError(error), { cause: error });
  }
}
