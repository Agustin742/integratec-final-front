import { z } from 'zod';
import type { components, operations } from '@/api/schema.generated';

// Keep Zod v4 compatible with the strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export const ROSTER_SEARCH_MAX_LENGTH = 100;

export type RosterGuardianDto = components['schemas']['RosterGuardianDto'];
export type RosterStudentDto = components['schemas']['RosterStudentDto'];
export type PaginatedClassroomRosterDto =
  operations['ClassroomRosterController_list']['responses'][200]['content']['application/json'];

const rosterMembershipStateSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const rosterGuardianSchema: z.ZodType<RosterGuardianDto> = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  state: rosterMembershipStateSchema,
});

export const rosterStudentSchema: z.ZodType<RosterStudentDto> = z.object({
  membershipId: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().min(1),
  state: rosterMembershipStateSchema,
  deletedAt: z.string().min(1).nullable(),
  guardians: z.array(rosterGuardianSchema),
});

export const paginatedClassroomRosterSchema: z.ZodType<PaginatedClassroomRosterDto> =
  z.object({
    items: z.array(rosterStudentSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  });
