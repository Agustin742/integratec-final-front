import { z } from 'zod';
import type { components } from '@/api/schema.generated';
import { avatarSchema } from '@/session/transport';
import { isHairAllowed, isTopAllowed, type Avatar } from './avatar-options';
import { profileMessages } from './messages';

// Zod v4 must never probe `new Function()` under the strict CSP (FD1).
z.config({ jitless: true });

export type OwnProfileDto = components['schemas']['OwnProfileDto'];
export type UpdateProfileDto = components['schemas']['UpdateProfileDto'];

/** `UpdateProfileDto.displayName`: 1–100 characters after trimming. */
export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 100;

// Contract: C0/C1 controls and Unicode line/paragraph separators are rejected
// before trimming.
const FORBIDDEN_CHARACTERS = /[\p{Cc}\u2028\u2029]/u;
// Contract: at least one character that is not whitespace, default-ignorable,
// a combining mark or the braille blank.
const VISIBLE_CHARACTER =
  /[^\p{White_Space}\p{Default_Ignorable_Code_Point}\p{M}\u2800]/u;

const validation = profileMessages.displayName.validation;

const trimmedDisplayName = z
  .string()
  .min(1, validation.required)
  .max(PROFILE_DISPLAY_NAME_MAX_LENGTH, validation.tooLong)
  .refine((value) => VISIBLE_CHARACTER.test(value), {
    message: validation.notVisible,
  });

export const displayNameFormSchema = z.object({
  displayName: z
    .string()
    .refine((value) => !FORBIDDEN_CHARACTERS.test(value), {
      message: validation.invalidCharacters,
    })
    .transform((value) => value.trim())
    .pipe(trimmedDisplayName),
});

export type DisplayNameFormInput = z.input<typeof displayNameFormSchema>;
export type DisplayNameFormOutput = z.output<typeof displayNameFormSchema>;

export const avatarFormSchema = avatarSchema.superRefine((value, ctx) => {
  const avatar: Avatar = value;
  if (!isHairAllowed(avatar)) {
    ctx.addIssue({
      code: 'custom',
      path: ['hairId'],
      message: profileMessages.avatar.validation.incompatibleHair,
    });
  }
  if (!isTopAllowed(avatar)) {
    ctx.addIssue({
      code: 'custom',
      path: ['topId'],
      message: profileMessages.avatar.validation.incompatibleTop,
    });
  }
});

export type AvatarFormValues = z.infer<typeof avatarFormSchema>;
