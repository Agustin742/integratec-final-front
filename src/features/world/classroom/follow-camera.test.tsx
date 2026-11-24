import { act, render } from '@testing-library/react';
import { OrthographicCamera, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CLASSROOM_BOUNDS, frameCamera } from '../camera';
import { FollowCamera } from './follow-camera';

const frame = vi.hoisted(() => ({
  callback: null as null | ((state: unknown, delta: number) => void),
  invalidate: vi.fn(),
  camera: null as unknown,
  size: { width: 1280, height: 720 },
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    frame.callback = callback;
  },
  useThree: (select?: (state: unknown) => unknown) => {
    const state = {
      camera: frame.camera,
      size: frame.size,
      invalidate: frame.invalidate,
    };
    return select ? select(state) : state;
  },
}));

const tick = (delta = 1 / 60) =>
  act(() => {
    frame.callback?.({}, delta);
  });

const screenOf = (camera: OrthographicCamera, x: number, z: number) =>
  new Vector3(x, 0.9, z).project(camera);

function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const original = window.matchMedia;

beforeEach(() => {
  frame.callback = null;
  frame.invalidate.mockClear();
  frame.camera = new OrthographicCamera();
  frame.size = { width: 1280, height: 720 };
  mockReducedMotion(false);
});

afterEach(() => {
  window.matchMedia = original;
});

describe('FollowCamera', () => {
  test('snaps onto the avatar on mount without flying in', () => {
    const pose = { current: { x: 1, z: 1, rotation: 0 } };
    render(<FollowCamera poseRef={pose} />);
    const camera = frame.camera as OrthographicCamera;
    const point = screenOf(camera, 1, 1);
    expect(Math.abs(point.x)).toBeLessThan(1e-6);
    expect(Math.abs(point.y)).toBeLessThan(1e-6);
    expect(frame.invalidate).toHaveBeenCalled();
  });

  test('damps after the avatar and stops requesting frames once settled', () => {
    const pose = { current: { x: 0, z: 0, rotation: 0 } };
    render(<FollowCamera poseRef={pose} />);
    const camera = frame.camera as OrthographicCamera;
    frame.invalidate.mockClear();
    pose.current = { x: 2, z: 0, rotation: 0 };
    tick();
    const lagging = screenOf(camera, 2, 0);
    expect(Math.abs(lagging.x)).toBeGreaterThan(0);
    expect(frame.invalidate).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 600; i += 1) tick();
    const settled = screenOf(camera, 2, 0);
    expect(Math.abs(settled.x)).toBeLessThan(1e-3);
    frame.invalidate.mockClear();
    tick();
    expect(frame.invalidate).not.toHaveBeenCalled();
  });

  test('follows instantly under reduced motion', () => {
    mockReducedMotion(true);
    const pose = { current: { x: 0, z: 0, rotation: 0 } };
    render(<FollowCamera poseRef={pose} />);
    const camera = frame.camera as OrthographicCamera;
    frame.invalidate.mockClear();
    pose.current = { x: 2, z: 0, rotation: 0 };
    tick();
    expect(Math.abs(screenOf(camera, 2, 0).x)).toBeLessThan(1e-6);
    frame.invalidate.mockClear();
    tick();
    expect(frame.invalidate).not.toHaveBeenCalled();
  });

  test('recomputes the frustum on resize and keeps following', () => {
    const pose = { current: { x: 0, z: 0, rotation: 0 } };
    const { rerender } = render(<FollowCamera poseRef={pose} />);
    const camera = frame.camera as OrthographicCamera;
    const wideAspect =
      (camera.right - camera.left) / (camera.top - camera.bottom);
    expect(wideAspect).toBeCloseTo(1280 / 720);
    frame.size = { width: 360, height: 640 };
    rerender(<FollowCamera poseRef={pose} />);
    expect(
      (camera.right - camera.left) / (camera.top - camera.bottom),
    ).toBeCloseTo(360 / 640);
    pose.current = { x: 1, z: 1, rotation: 0 };
    for (let i = 0; i < 600; i += 1) tick();
    expect(Math.abs(screenOf(camera, 1, 1).x)).toBeLessThan(1e-3);
  });

  test('frames the whole classroom when there is no avatar to follow', () => {
    render(<FollowCamera poseRef={undefined} />);
    const expected = new OrthographicCamera();
    frameCamera(expected, 1280, 720, CLASSROOM_BOUNDS);
    const camera = frame.camera as OrthographicCamera;
    expect(camera.projectionMatrix.equals(expected.projectionMatrix)).toBe(
      true,
    );
    expect(camera.position.equals(expected.position)).toBe(true);
  });
});
