import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLASSROOM_KIT_MANIFEST,
  getKitModuleUrl,
} from './classroom-kit-manifest';

describe('classroom kit manifest', () => {
  const entries = Object.entries(CLASSROOM_KIT_MANIFEST);

  it('lists all 19 modules with unique URLs', () => {
    expect(entries).toHaveLength(19);
    expect(new Set(entries.map(([, url]) => url)).size).toBe(19);
  });

  it.each(entries)('%s points to an existing GLB', (_id, url) => {
    expect(existsSync(resolve(process.cwd(), 'public', url.slice(1)))).toBe(
      true,
    );
  });

  it('resolves a module URL', () => {
    expect(getKitModuleUrl('wall-solid')).toBe(
      '/models/scenes/classroom/shell/wall-solid.glb',
    );
  });
});
