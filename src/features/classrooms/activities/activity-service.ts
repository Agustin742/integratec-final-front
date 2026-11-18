import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { ActivityListQueryParams } from '@/api/query-keys';
import {
  activityDetailDtoSchema,
  paginatedActivityListSchema,
  type ActivityDetailDto,
  type PaginatedActivityListDto,
} from './activity-schema';
import { activityMessages } from './messages';

export interface ActivityServiceOptions {
  readonly signal?: AbortSignal;
}

/**
 * Lists classroom activities (`GET /classrooms/{id}/activities`).
 */
export async function listClassroomActivities(
  client: TypedApiClient,
  classroomId: string,
  params: ActivityListQueryParams = {},
  options: ActivityServiceOptions = {},
): Promise<PaginatedActivityListDto> {
  const raw = await requestApi(() =>
    client.GET('/classrooms/{id}/activities', {
      params: {
        path: { id: classroomId },
        query: {
          page: params.page,
          pageSize: params.pageSize,
          sort: params.sort,
          state: params.state,
        },
      },
      signal: options.signal,
    }),
  );

  const parsed = paginatedActivityListSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: 200,
      code: null,
      userMessage: activityMessages.errorDescription,
    });
  }
  return parsed.data;
}

/**
 * Fetches one classroom activity detail (`GET /classrooms/{id}/activities/{activityId}`).
 */
export async function getClassroomActivity(
  client: TypedApiClient,
  classroomId: string,
  activityId: string,
  options: ActivityServiceOptions = {},
): Promise<ActivityDetailDto> {
  const raw = await requestApi(() =>
    client.GET('/classrooms/{id}/activities/{activityId}', {
      params: {
        path: { id: classroomId, activityId },
      },
      signal: options.signal,
    }),
  );

  const parsed = activityDetailDtoSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: 200,
      code: null,
      userMessage: activityMessages.errorDescription,
    });
  }
  return parsed.data;
}
