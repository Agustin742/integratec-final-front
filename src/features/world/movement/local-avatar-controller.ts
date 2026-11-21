import type { AvatarInput, ClassroomLayout } from '@/realtime';
import { directionToward, findPath, type Waypoint } from './pathfinding';
import { stepAvatar, type Direction, type Pose } from './step-avatar';

/**
 * Distance at which a waypoint counts as reached. Must be at least half the
 * distance covered per step (speed * dt / 2), which {@link MAX_FRAME_SECONDS}
 * guarantees: 3 u/s * 0.05 s / 2 = 0.075 < 0.08.
 */
export const ARRIVE_RADIUS = 0.08;

/** Longest frame delta simulated at once; a tab hitch must not skip past a waypoint. */
export const MAX_FRAME_SECONDS = 0.05;

const ZERO: AvatarInput = { x: 0, z: 0 };

export interface StepResult {
  pose: Pose;
  /** True when the position changed during this step. */
  moving: boolean;
  /** True only on the step that completes the destination. */
  arrived: boolean;
}

export interface LocalAvatarControllerOptions {
  layout: ClassroomLayout;
  spawn: Pose;
  /** Fired only when the movement intent changes, never per frame. */
  onIntentChange?: ((intent: AvatarInput) => void) | undefined;
}

/**
 * Framework-free local movement: keyboard direction, click destination and
 * the resulting pose. Local only; the server stays the authority (#37).
 * Keyboard input always wins and cancels any destination.
 */
export class LocalAvatarController {
  private layout: ClassroomLayout;
  private onIntentChange: ((intent: AvatarInput) => void) | undefined;
  private current: Pose;
  private keyboard: Direction = ZERO;
  private waypoints: Waypoint[] = [];
  private lastIntent: AvatarInput = ZERO;

  constructor({ layout, spawn, onIntentChange }: LocalAvatarControllerOptions) {
    this.layout = layout;
    this.current = { ...spawn };
    this.onIntentChange = onIntentChange;
  }

  /** Swaps the walkable layout and intent listener without touching pose or input. */
  configure(
    layout: ClassroomLayout,
    onIntentChange: ((intent: AvatarInput) => void) | undefined,
  ): void {
    this.layout = layout;
    this.onIntentChange = onIntentChange;
  }

  get pose(): Pose {
    return this.current;
  }

  get hasDestination(): boolean {
    return this.waypoints.length > 0;
  }

  /** Current movement intent in the `AvatarInput` shape; zero when idle. */
  get intent(): AvatarInput {
    return this.lastIntent;
  }

  /** Sets the held-key direction. Any non-zero direction cancels the destination. */
  setKeyboardDirection(direction: Direction): void {
    this.keyboard = direction;
    if (direction.x !== 0 || direction.z !== 0) this.waypoints = [];
    this.publishIntent();
  }

  /**
   * Walks to `point` along an obstacle-free route. Returns false, leaving any
   * current destination untouched, when the point is unwalkable or unreachable.
   */
  setDestination(point: Waypoint): boolean {
    const path = findPath(this.layout, this.current, point);
    if (path === null || path.length === 0) return false;
    this.waypoints = path;
    this.publishIntent();
    return true;
  }

  clearDestination(): void {
    this.waypoints = [];
    this.publishIntent();
  }

  /** Drops all input and the destination and puts the avatar back at `spawn`. */
  reset(spawn: Pose): void {
    this.current = { ...spawn };
    this.keyboard = ZERO;
    this.waypoints = [];
    this.publishIntent();
  }

  /** Advances one frame. Meant for `useFrame`; allocates nothing per call beyond the pose. */
  step(dtSeconds: number): StepResult {
    const dt = Math.min(Math.max(dtSeconds, 0), MAX_FRAME_SECONDS);
    let arrived = false;
    if (!this.hasKeyboard() && this.hasDestination) {
      const follow = directionToward(
        this.current,
        this.waypoints,
        ARRIVE_RADIUS,
      );
      if (follow.arrived) {
        this.waypoints = [];
        arrived = true;
      } else {
        this.waypoints = follow.remaining;
      }
    }
    const intent = this.computeIntent();
    const next = stepAvatar(this.layout, this.current, intent, dt);
    const moving = next.x !== this.current.x || next.z !== this.current.z;
    this.current = next;
    this.publishIntent();
    return { pose: next, moving, arrived };
  }

  private hasKeyboard(): boolean {
    return this.keyboard.x !== 0 || this.keyboard.z !== 0;
  }

  private computeIntent(): AvatarInput {
    if (this.hasKeyboard()) return this.keyboard;
    if (this.hasDestination)
      return directionToward(this.current, this.waypoints, ARRIVE_RADIUS)
        .direction;
    return ZERO;
  }

  private publishIntent(): void {
    const next = this.computeIntent();
    if (next.x === this.lastIntent.x && next.z === this.lastIntent.z) return;
    this.lastIntent = { x: next.x, z: next.z };
    this.onIntentChange?.(this.lastIntent);
  }
}
