import { z } from 'zod';
import type { components } from '@/api/schema.generated';

z.config({ jitless: true });

export type MaterialDto = components['schemas']['MaterialDto'];
export type MaterialDownloadDto = components['schemas']['MaterialDownloadDto'];
export type MaterialContentType = MaterialDto['contentType'];

/** Allowed MIME types from `MaterialDto.contentType` in `schema.generated.ts`. */
export const MATERIAL_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const satisfies readonly MaterialContentType[];

/** Maximum file size from `MaterialsController_upload` 413 response (10 MiB). */
export const MATERIAL_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const materialContentTypeSchema = z.enum(MATERIAL_ALLOWED_MIME_TYPES);

export const materialDtoSchema: z.ZodType<MaterialDto> = z.object({
  id: z.string().uuid(),
  classroomId: z.string().uuid(),
  authorId: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  contentType: materialContentTypeSchema,
  sizeBytes: z.number().int().nonnegative().max(MATERIAL_MAX_SIZE_BYTES),
  createdAt: z.string().datetime({ offset: true }),
});

export interface PaginatedMaterialListDto {
  readonly items: MaterialDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export const paginatedMaterialListSchema: z.ZodType<PaginatedMaterialListDto> =
  z.object({
    items: z.array(materialDtoSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
  });

function isHttpOrHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const materialDownloadDtoSchema: z.ZodType<MaterialDownloadDto> =
  z.object({
    url: z.string().url().refine(isHttpOrHttpsUrl, {
      message: 'Download URL must use http or https.',
    }),
    expiresInSeconds: z.number().int().positive(),
  });

export type MaterialFileCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'empty' | 'type' | 'size' };

/**
 * Client-side usability pre-check against the OpenAPI contract limits.
 * The server remains authoritative for file type, size, and content validation.
 */
export function validateMaterialFile(file: File): MaterialFileCheckResult {
  if (!(MATERIAL_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: 'type' };
  }
  if (file.size <= 0) {
    return { ok: false, reason: 'empty' };
  }
  if (file.size > MATERIAL_MAX_SIZE_BYTES) {
    return { ok: false, reason: 'size' };
  }
  return { ok: true };
}
