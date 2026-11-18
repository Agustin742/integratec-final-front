import { z } from 'zod';
import type { components } from '@/api/schema.generated';
import { joinMessages } from './join-messages';

// Ensure Zod v4 runs in jitless mode so schemas never invoke `new Function()`
// under our strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export const INVITATION_TOKEN_MAX_LENGTH = 128;
export const CLASSROOM_CODE_MIN_LENGTH = 4;
export const CLASSROOM_CODE_MAX_LENGTH = 32;

const DISALLOWED_TOKEN_CHARS = /[\s\p{Cc}\u2028\u2029]/u;
const CLASSROOM_CODE_PATTERN = /^[A-Z0-9]+$/;

export const invitationTokenSchema = z
  .string()
  .min(1, joinMessages.validation.tokenRequired)
  .max(INVITATION_TOKEN_MAX_LENGTH, joinMessages.validation.tokenTooLong)
  .refine(
    (value) => !DISALLOWED_TOKEN_CHARS.test(value),
    joinMessages.validation.tokenInvalid,
  );

export const acceptInvitationSchema = z.object({
  token: invitationTokenSchema,
});

export type AcceptInvitationInput = z.input<typeof acceptInvitationSchema>;
export type AcceptInvitationDto = components['schemas']['AcceptInvitationDto'];

export const joinClassroomByCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, joinMessages.validation.codeRequired)
    .max(CLASSROOM_CODE_MAX_LENGTH, joinMessages.validation.codeTooLong)
    .transform((value) => value.toUpperCase())
    .pipe(
      z
        .string()
        .min(CLASSROOM_CODE_MIN_LENGTH, joinMessages.validation.codeTooShort)
        .regex(CLASSROOM_CODE_PATTERN, joinMessages.validation.codeFormat),
    ),
});

export type JoinClassroomByCodeInput = z.input<
  typeof joinClassroomByCodeSchema
>;
export type JoinClassroomByCodeOutput = z.output<
  typeof joinClassroomByCodeSchema
>;
export type JoinClassroomWithCodeDto =
  components['schemas']['JoinClassroomWithCodeDto'];

export const assignedDeskSchema = z.object({
  id: z.string().trim().min(1),
  deskIndex: z.number().int().min(1),
});

export const joinClassroomResponseSchema = z.object({
  classroomId: z.string().trim().min(1),
  membershipId: z.string().trim().min(1),
  role: z.enum(['TEACHER', 'STUDENT']),
  desk: assignedDeskSchema.nullable(),
  alreadyMember: z.boolean(),
});

export type JoinClassroomResponse = z.output<
  typeof joinClassroomResponseSchema
>;

export type InvitationQueryTokenState =
  | { readonly status: 'absent' }
  | { readonly status: 'invalid' }
  | { readonly status: 'valid'; readonly token: string };

/**
 * Validates the `?token=` query parameter on `/invitations/accept`.
 * Repeated parameters or non-token characters are rejected without calling the API.
 */
export function validateInvitationQueryToken(
  searchParams: URLSearchParams,
): InvitationQueryTokenState {
  if (!searchParams.has('token')) {
    return { status: 'absent' };
  }
  const values = searchParams.getAll('token');
  if (values.length !== 1) {
    return { status: 'invalid' };
  }
  const parsed = invitationTokenSchema.safeParse(values[0]);
  if (!parsed.success) {
    return { status: 'invalid' };
  }
  return { status: 'valid', token: parsed.data };
}

/**
 * Reads a transient `joinOutcome` passed in router location state after accepting
 * an invitation or joining by code, verified against the active `classroomId`.
 */
export function readClassroomJoinOutcome(
  locationState: unknown,
  expectedClassroomId: string,
): JoinClassroomResponse | null {
  if (
    typeof locationState !== 'object' ||
    locationState === null ||
    !('joinOutcome' in locationState)
  ) {
    return null;
  }
  const candidate = (locationState as { joinOutcome?: unknown }).joinOutcome;
  const parsed = joinClassroomResponseSchema.safeParse(candidate);
  if (!parsed.success) {
    return null;
  }
  if (parsed.data.classroomId !== expectedClassroomId) {
    return null;
  }
  return parsed.data;
}
