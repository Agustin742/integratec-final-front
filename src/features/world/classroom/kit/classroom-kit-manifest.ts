/**
 * Modular classroom kit manifest: module id -> public GLB URL
 * (`docs/art/classroom-shell.md`, `docs/art/classroom-furniture.md`,
 * `docs/art/classroom-interactive.md`, `docs/art/classroom-decoration.md`,
 * `docs/art/classroom-desk-decor.md`).
 * Assets are Draco-compressed, +Y up, face +Z, 1 unit = 1 m, transforms applied.
 */
const SHELL_BASE = '/models/scenes/classroom/shell';
const FURNITURE_BASE = '/models/scenes/classroom/furniture';
const INTERACTIVE_BASE = '/models/scenes/classroom/interactive';
const DECORATION_BASE = '/models/scenes/classroom/decoration';
const DESK_DECOR_BASE = '/models/scenes/classroom/desk-decor';

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

/**
 * Interactive props (`docs/art/classroom-interactive.md`) and the tutor corner
 * station (`docs/art/tutor-bot.md`). Only props backed by an existing feature
 * are listed; the rest of the interactive GLBs stay unplaced.
 */
export const CLASSROOM_INTERACTIVE_MODULES = {
  'board-collaborative': `${INTERACTIVE_BASE}/board-collaborative.glb`,
  'bot-station': '/models/bot/bot-station.glb',
  'bulletin-board': `${INTERACTIVE_BASE}/bulletin-board.glb`,
  'chat-computer': `${INTERACTIVE_BASE}/chat-computer.glb`,
  door: `${INTERACTIVE_BASE}/door.glb`,
  'pet-bed': `${INTERACTIVE_BASE}/pet-bed.glb`,
  'report-card-stand': `${INTERACTIVE_BASE}/report-card-stand.glb`,
  'shop-kiosk': `${INTERACTIVE_BASE}/shop-kiosk.glb`,
} as const;

/**
 * Seasonal, institutional and room decorations
 * (`docs/art/classroom-decoration.md`).
 */
export const CLASSROOM_DECORATION_MODULES = {
  'christmas-tree': `${DECORATION_BASE}/christmas-tree.glb`,
  'flag-argentina': `${DECORATION_BASE}/flag-argentina.glb`,
  'flag-integrar': `${DECORATION_BASE}/flag-integrar.glb`,
  garlands: `${DECORATION_BASE}/garlands.glb`,
  globe: `${DECORATION_BASE}/globe.glb`,
  'plants-and-pots': `${DECORATION_BASE}/plants-and-pots.glb`,
  rug: `${DECORATION_BASE}/rug.glb`,
  'wall-clock': `${DECORATION_BASE}/wall-clock.glb`,
  'wall-map': `${DECORATION_BASE}/wall-map.glb`,
  'wall-posters': `${DECORATION_BASE}/wall-posters.glb`,
} as const;

/** Shop desk upgrades, one per student desk (`docs/art/classroom-desk-decor.md`). */
export const CLASSROOM_DESK_DECOR_MODULES = {
  'desk-decor-figurine': `${DESK_DECOR_BASE}/figurine.glb`,
  'desk-decor-lamp': `${DESK_DECOR_BASE}/lamp.glb`,
  'desk-decor-mini-globe': `${DESK_DECOR_BASE}/mini-globe.glb`,
  'desk-decor-mug': `${DESK_DECOR_BASE}/mug.glb`,
  'desk-decor-photo-frame': `${DESK_DECOR_BASE}/photo-frame.glb`,
  'desk-decor-plant': `${DESK_DECOR_BASE}/plant.glb`,
  'desk-decor-puzzle-cube': `${DESK_DECOR_BASE}/puzzle-cube.glb`,
} as const;

export const CLASSROOM_KIT_MANIFEST = {
  ...CLASSROOM_SHELL_MODULES,
  ...CLASSROOM_FURNITURE_MODULES,
  ...CLASSROOM_INTERACTIVE_MODULES,
  ...CLASSROOM_DECORATION_MODULES,
  ...CLASSROOM_DESK_DECOR_MODULES,
} as const;

export type ClassroomKitModuleId = keyof typeof CLASSROOM_KIT_MANIFEST;

export function getKitModuleUrl(moduleId: ClassroomKitModuleId): string {
  return CLASSROOM_KIT_MANIFEST[moduleId];
}
