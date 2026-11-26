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
    transparent: true,
    hostClassName: expect.stringContaining('stage-backdrop'),
    onUnavailable,
  });
  expect(scene.model).toMatchObject({
    avatar: plan.avatar,
    face: 'happy',
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

test('waves and plays another animation without changing the outfit', () => {
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
  for (const outfit of outfits) expect(outfit).toBe(outfits[0]);
});

test('keeps the same character and scenery until the page reloads', () => {
  let draws = 0;
  const changing = () => ((draws += 1) * 0.137) % 1;
  const show = () =>
    render(
      <PreviewScene3D
        label="Escena"
        random={changing}
        onUnavailable={onUnavailable}
      />,
    );

  const first = show();
  const avatar = scene.model?.avatar;
  const urls = scene.assets.map((asset) => asset.url);
  first.unmount();
  scene.assets = [];
  show();

  expect(scene.model?.avatar).toBe(avatar);
  expect(scene.assets.map((asset) => asset.url)).toEqual(urls);
});

test('holds one static pose under reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  renderScene();
  step();
  step();

  expect(scene.model).toMatchObject({
    avatar: plan.avatar,
    animation: 'Idle',
  });
  expect(vi.getTimerCount()).toBe(0);
});

test('reports a body that cannot load as unavailable', () => {
  renderScene();
  (scene.model?.onBodyError as () => void)();
  expect(onUnavailable).toHaveBeenCalled();
});
