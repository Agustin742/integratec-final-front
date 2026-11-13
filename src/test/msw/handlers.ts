import { HttpResponse, http, type HttpHandler } from 'msw';
import type { components } from '../../api/schema.generated';

export type HealthStatusPayload = components['schemas']['HealthStatus'];
export type ErrorBodyPayload = components['schemas']['ErrorBody'];
export type ErrorEnvelopePayload = components['schemas']['ErrorEnvelope'];

export type ClassroomDetailPayload =
  components['schemas']['ClassroomDetailResponseDto'];

export const TEST_API_BASE_URL = 'https://api.example.invalid';

/**
 * Builds a contract-faithful `ErrorEnvelope` JSON response (`src/api/schema.generated.ts`)
 * for MSW handlers and tests.
 */
export function createErrorEnvelopeResponse(
  status: number,
  error: ErrorBodyPayload,
): Response {
  const body: ErrorEnvelopePayload = { error };
  return HttpResponse.json(body, {
    status,
    headers: {
      'x-request-id': error.correlationId,
    },
  });
}

/**
 * Contract-faithful MSW handler for `GET /health` (`HealthController_getHealth`).
 */
export function createHealthHandler(
  baseUrl: string = TEST_API_BASE_URL,
  overrides: Partial<HealthStatusPayload> = {},
): HttpHandler {
  const payload: HealthStatusPayload = {
    status: 'ok',
    service: 'api',
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  return http.get(`${baseUrl}/health`, () => HttpResponse.json(payload));
}

/**
 * Contract-faithful MSW handler for `GET /classrooms/{id}`
 * (`ClassroomsController_findOne`): the caller's `myRole` and `capabilities`.
 */
export function createClassroomDetailHandler(
  id: string,
  overrides: Partial<ClassroomDetailPayload> = {},
  baseUrl: string = TEST_API_BASE_URL,
): HttpHandler {
  const payload: ClassroomDetailPayload = {
    id,
    name: 'Synthetic classroom',
    subject: null,
    schoolId: null,
    independentTeacherId: null,
    adultMode: false,
    chatMuted: false,
    collaborationLocked: false,
    gamesDisabled: false,
    myRole: 'STUDENT',
    capabilities: [],
    deskCount: 0,
    pet: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  return http.get(`${baseUrl}/classrooms/${id}`, () =>
    HttpResponse.json(payload),
  );
}

export const defaultHandlers: readonly HttpHandler[] = [createHealthHandler()];
