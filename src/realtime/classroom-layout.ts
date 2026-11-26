import {
  MIN_CLASSROOM_DESKS,
  buildClassroomLayout,
} from './contracts.generated';

/**
 * The base twelve-desk classroom, used until a per-classroom layout is
 * available: `buildClassroomLayout` is the single source the server also uses.
 */
export const CLASSROOM_LAYOUT = buildClassroomLayout(MIN_CLASSROOM_DESKS);
