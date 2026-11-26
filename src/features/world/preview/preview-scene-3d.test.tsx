import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { AvatarModelProps } from '../avatar/avatar-model';
import type { GlbAssetProps } from '../glb-asset';
import type { WorldCanvasProps } from '../world-canvas';
import { PreviewScene3D, PREVIEW_STEP_MS } from './preview-scene-3d';
import { planPreviewScene } from './preview-scene-plan';

const scene = vi.hoisted(() => ({
  canvas: null as null | Record<string, unknown>,
  model: null as null | Record<string, unknown>,
  assets: [] as Record<string, unknown>[],
}));

vi.mock('../world-canvas', () => ({
  WorldCanvas: (props: WorldCanvasProps) => {
    scene.canvas = props as unknown as Record<string, unknown>;
    return <div>{props.children}</div>;
  },
}));
vi.mock('../world-lighting', () => ({ WarmLighting: () => null }));
vi.mock('../avatar/avatar-model', () => ({
  AvatarModel: (props: AvatarModelProps) => {
    scene.model = props as unknown as Record<string, unknown>;
    return <div data-testid="avatar" />;
  },
}));
vi.mock('../glb-asset', () => ({
  GlbAsset: (props: GlbAssetProps) => {
    scene.assets.push(props as unknown as Record<string, unknown>);
    return <div data-testid="piece" />;
  },
}));

const random = () => 0.42;
const plan = planPreviewScene(random);
const onUnavailable = vi.fn();

function renderScene() {
  return render(
    <PreviewScene3D
      label="Escena"
      random={random}
      onUnavailable={onUnavailable}
    />,
  );
}

const step = () => act(() => vi.advanceTimersByTime(PREVIEW_STEP_MS));

beforeEach(() => {
  scene.canvas = null;
  scene.model = null;
  scene.assets = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('shows the planned character and scenery in a quiet front view', () => {
  renderScene();

  expect(scene.canvas).toMatchObject({
    framing: 'preview',
    role: 'img',
    label: 'Escena',
    scopeKey: 'auth-preview',
    loading: null,
    onUnavailable,
  });
  expect(scene.model).toMatchObject({
    avatar: plan.avatars[0],
    animation: 'Wave',
    scopeKey: 'auth-preview',
  });
  expect(screen.getAllByTestId('piece')).toHaveLength(plan.pieces.length);
  for (const asset of scene.assets) {
    expect(asset.scopeKey).toBe('auth-preview');
    // A failed piece leaves nothing behind, not the placeholder box.
    expect(asset.errorFallback).toBeTruthy();
  }
});

test('waves, plays another animation and keeps changing the outfit', () => {
  renderScene();
  const clips = [scene.model?.animation];
  const outfits = [scene.model?.avatar];

  for (let i = 0; i < 5; i += 1) {
    step();
    clips.push(scene.model?.animation);
    outfits.push(scene.model?.avatar);
  }

  expect(clips).toEqual([
    'Wave',
    plan.extraClip,
    'Idle',
    'Wave',
    plan.extraClip,
    'Idle',
  ]);
  expect(outfits).toEqual([0, 0, 1, 1, 2, 2].map((i) => plan.avatars[i]));
});

test('holds one static pose and outfit under reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  renderScene();
  step();
  step();

  expect(scene.model).toMatchObject({
    avatar: plan.avatars[0],
    animation: 'Idle',
  });
  expect(vi.getTimerCount()).toBe(0);
});

test('reports a body that cannot load as unavailable', () => {
  renderScene();
  (scene.model?.onBodyError as () => void)();
  expect(onUnavailable).toHaveBeenCalled();
});
