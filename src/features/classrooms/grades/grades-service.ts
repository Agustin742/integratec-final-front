import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { NormalizedGradesMetricsQueryParams } from '@/api/query-keys';
import { gradesMessages } from './messages';
import {
  classroomMetricsSchema,
  ownDailyMetricsSchema,
  studentReportCardSchema,
  type ClassroomMetrics,
  type OwnDailyMetrics,
  type StudentReportCard,
} from './grades-schema';

function toUnexpectedPayloadError(): ApiError {
  return new ApiError({
    kind: 'unexpected',
    status: 200,
    code: null,
    userMessage: gradesMessages.error.unexpected,
  });
}

/**
 * `GET /classrooms/{id}/me/report-card`: the authenticated student's graded
 * activities (score, feedback, net credited points), latest grading first.
 * The server is the only source of every displayed value.
 */
export async function fetchStudentReportCard(
  client: TypedApiClient,
  classroomId: string,
  params: NormalizedGradesMetricsQueryParams,
  options: { readonly signal?: AbortSignal } = {},
): Promise<StudentReportCard> {
  const payload: unknown = await requestApi(() =>
    client.GET('/classrooms/{id}/me/report-card', {
      params: { path: { id: classroomId }, query: params },
      signal: options.signal,
    }),
  );

  const parsed = studentReportCardSchema.safeParse(payload);
  if (!parsed.success) {
    throw toUnexpectedPayloadError();
  }
  return parsed.data;
}

/**
 * `GET /classrooms/{id}/me/activity-metrics`: the caller's own raw daily
 * activity signals, latest day first.
 */
export async function fetchOwnDailyMetrics(
  client: TypedApiClient,
  classroomId: string,
  params: NormalizedGradesMetricsQueryParams,
  options: { readonly signal?: AbortSignal } = {},
): Promise<OwnDailyMetrics> {
  const payload: unknown = await requestApi(() =>
    client.GET('/classrooms/{id}/me/activity-metrics', {
      params: { path: { id: classroomId }, query: params },
      signal: options.signal,
    }),
  );

  const parsed = ownDailyMetricsSchema.safeParse(payload);
  if (!parsed.success) {
    throw toUnexpectedPayloadError();
  }
  return parsed.data;
}

/**
 * `GET /classrooms/{id}/activity-metrics`: raw per-student activity totals
 * for teaching staff, display name ascending. No combined level is computed
 * here or in the browser; the server exposes raw values only.
 */
export async function fetchClassroomMetrics(
  client: TypedApiClient,
  classroomId: string,
  params: NormalizedGradesMetricsQueryParams,
  options: { readonly signal?: AbortSignal } = {},
): Promise<ClassroomMetrics> {
  const payload: unknown = await requestApi(() =>
    client.GET('/classrooms/{id}/activity-metrics', {
      params: { path: { id: classroomId }, query: params },
      signal: options.signal,
    }),
  );

  const parsed = classroomMetricsSchema.safeParse(payload);
  if (!parsed.success) {
    throw toUnexpectedPayloadError();
  }
  return parsed.data;
}
