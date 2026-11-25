/**
 * Modular classroom kit manifest: module id -> public GLB URL
 * (`docs/art/classroom-shell.md`, `docs/art/classroom-furniture.md`).
 * Assets are Draco-compressed, +Y up, face +Z, 1 unit = 1 m, transforms applied.
 */
const SHELL_BASE = '/models/scenes/classroom/shell';
const FURNITURE_BASE = '/models/scenes/classroom/furniture';

export const CLASSROOM_SHELL_MODULES = {
  'baseboard-cutaway': `${SHELL_BASE}/baseboard-cutaway.glb`,
  'baseboard-doorway-post': `${SHELL_BASE}/baseboard-doorway-post.glb`,
  'baseboard-wall': `${SHELL_BASE}/baseboard-wall.glb`,
  'ceiling-light': `${SHELL_BASE}/ceiling-light.glb`,
  'floor-threshold': `${SHELL_BASE}/floor-threshold.glb`,
  'floor-tile': `${SHELL_BASE}/floor-tile.glb`,
  'wall-corner': `${SHELL_BASE}/wall-corner.glb`,
  'wall-solid': `${SHELL_BASE}/wall-solid.glb`,
  'wall-window': `${SHELL_BASE}/wall-window.glb`,
  window: `${SHELL_BASE}/window.glb`,
  'window-curtains': `${SHELL_BASE}/window-curtains.glb`,
} as const;

export const CLASSROOM_FURNITURE_MODULES = {
  board: `${FURNITURE_BASE}/board.glb`,
  bookshelf: `${FURNITURE_BASE}/bookshelf.glb`,
  cabinet: `${FURNITURE_BASE}/cabinet.glb`,
  'coat-rack': `${FURNITURE_BASE}/coat-rack.glb`,
  'student-chair': `${FURNITURE_BASE}/student-chair.glb`,
  'student-desk': `${FURNITURE_BASE}/student-desk.glb`,
  'teacher-desk': `${FURNITURE_BASE}/teacher-desk.glb`,
  'trash-bin': `${FURNITURE_BASE}/trash-bin.glb`,
} as const;

export const CLASSROOM_KIT_MANIFEST = {
  ...CLASSROOM_SHELL_MODULES,
  ...CLASSROOM_FURNITURE_MODULES,
} as const;

export type ClassroomKitModuleId = keyof typeof CLASSROOM_KIT_MANIFEST;

export function getKitModuleUrl(moduleId: ClassroomKitModuleId): string {
  return CLASSROOM_KIT_MANIFEST[moduleId];
}
