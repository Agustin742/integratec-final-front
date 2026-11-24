import { z } from 'zod';
import type { components } from '@/api/schema.generated';

export type MaterialModuleDto = components['schemas']['MaterialModuleDto'];
export type MaterialModuleListDto =
  components['schemas']['MaterialModuleListDto'];

/** Limits from `MATERIAL_MODULE_LIMITS` in the API contract. */
export const MODULE_NAME_MAX_LENGTH = 80;
export const MODULE_DESCRIPTION_MAX_LENGTH = 500;
export const MODULE_CAP = 100;

export const materialModuleDtoSchema: z.ZodType<MaterialModuleDto> = z.object({
  id: z.string().uuid(),
  classroomId: z.string().uuid(),
  name: z.string().min(1).max(MODULE_NAME_MAX_LENGTH),
  description: z.string().max(MODULE_DESCRIPTION_MAX_LENGTH).nullable(),
  position: z.number().int().nonnegative(),
  materialCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const materialModuleListSchema: z.ZodType<MaterialModuleListDto> =
  z.object({
    items: z.array(materialModuleDtoSchema),
  });

export interface ModuleFormValues {
  readonly name: string;
  readonly description: string;
}

export type ModuleFormCheck =
  | { readonly ok: true; readonly name: string; readonly description: string }
  | { readonly ok: false; readonly field: 'name' | 'description' };

/** Client-side usability check; the server stays authoritative. */
export function checkModuleForm(values: ModuleFormValues): ModuleFormCheck {
  const name = values.name.trim();
  const description = values.description.trim();
  if (name.length === 0 || name.length > MODULE_NAME_MAX_LENGTH) {
    return { ok: false, field: 'name' };
  }
  if (description.length > MODULE_DESCRIPTION_MAX_LENGTH) {
    return { ok: false, field: 'description' };
  }
  return { ok: true, name, description };
}
