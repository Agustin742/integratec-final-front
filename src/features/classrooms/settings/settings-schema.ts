import { z } from 'zod';
import {
  TUTOR_BOT_SKINS,
  toTutorBotSkin,
} from '@/realtime/contracts.generated';
import {
  classroomFormSchema,
  type ClassroomDetailResponseDto,
  type UpdateClassroomPayload,
} from '../classroom-schema';

z.config({ jitless: true });

/**
 * Settings form: the `PATCH /classrooms/{id}` fields the product enforces. `collaborationLocked` and
 * `gamesDisabled` are stored by the API but nothing consumes them yet, so they
 * are deliberately not exposed (and never sent, so they are never overwritten). Name, subject and
 * adult mode reuse the create/edit schema so limits stay in one place.
 */
export const classroomSettingsFormSchema = classroomFormSchema
  .pick({ name: true, subject: true, adultMode: true })
  .extend({
    chatMuted: z.boolean(),
    tutorBotSkin: z.enum(TUTOR_BOT_SKINS),
  });

export type ClassroomSettingsFormInput = z.input<
  typeof classroomSettingsFormSchema
>;
export type ClassroomSettingsFormOutput = z.output<
  typeof classroomSettingsFormSchema
>;

/** Form values that mirror what the server currently stores. */
export function toSettingsFormValues(
  classroom: Pick<
    ClassroomDetailResponseDto,
    'name' | 'subject' | 'adultMode' | 'chatMuted' | 'tutorBotSkin'
  >,
): ClassroomSettingsFormInput {
  return {
    name: classroom.name,
    subject: classroom.subject ?? '',
    adultMode: classroom.adultMode,
    chatMuted: classroom.chatMuted,
    tutorBotSkin: toTutorBotSkin(classroom.tutorBotSkin),
  };
}

/**
 * `previousSkin` is the skin the form started from. The skin is sent only when
 * the user changed it, so a stored value this build does not know (read as
 * `none`) is never overwritten by an unrelated save.
 */
export function toSettingsUpdatePayload(
  values: ClassroomSettingsFormOutput,
  previousSkin?: ClassroomSettingsFormOutput['tutorBotSkin'],
): UpdateClassroomPayload {
  return {
    name: values.name,
    subject: values.subject === '' ? null : values.subject,
    adultMode: values.adultMode,
    chatMuted: values.chatMuted,
    ...(values.tutorBotSkin !== previousSkin
      ? { tutorBotSkin: values.tutorBotSkin }
      : {}),
  };
}
