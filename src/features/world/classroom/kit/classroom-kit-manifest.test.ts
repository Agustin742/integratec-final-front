import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLASSROOM_INTERACTIVE_MODULES,
  CLASSROOM_KIT_MANIFEST,
  getKitModuleUrl,
} from './classroom-kit-manifest';

describe('classroom kit manifest', () => {
  const entries = Object.entries(CLASSROOM_KIT_MANIFEST);

  it('lists all 25 modules with unique URLs', () => {
    expect(entries).toHaveLength(25);
    expect(new Set(entries.map(([, url]) => url)).size).toBe(25);
  });

  it('registers the interactive props and the bot station', () => {
    expect(getKitModuleUrl('door')).toBe(
      '/models/scenes/classroom/interactive/door.glb',
    );
    expect(Object.keys(CLASSROOM_INTERACTIVE_MODULES).sort()).toEqual([
      'board-collaborative',
      'bot-station',
      'bulletin-board',
      'door',
      'pet-bed',
      'shop-kiosk',
    ]);
    expect(getKitModuleUrl('bot-station')).toBe('/models/bot/bot-station.glb');
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
