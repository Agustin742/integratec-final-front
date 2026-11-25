import { Group, Mesh, BoxGeometry, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { computeFrame, measureFrame } from './call-stage-framing';

const window_ = (frame: ReturnType<typeof computeFrame>) => ({
  bottom: frame.centerY - frame.half,
  top: frame.centerY + frame.half,
});

describe('computeFrame', () => {
  // Measured from the shipped avatar GLBs at runtime (body + hair), in meters:
  // head bone DEF-spine006 at the neck joint, crown of the hair on top.
  const adult = { headY: 0.792, topY: 1.323 };

  it('shows the full head and the shoulders', () => {
    const { bottom, top } = window_(computeFrame(adult));
    expect(top).toBeGreaterThan(adult.topY);
    expect(bottom).toBeLessThan(adult.headY - 0.2);
  });

  it('leaves small headroom above the crown', () => {
    const { top } = window_(computeFrame(adult));
    expect(top - adult.topY).toBeGreaterThan(0.02);
    expect(top - adult.topY).toBeLessThan(0.15);
  });

  it('keeps the head in the upper part of the tile', () => {
    const frame = computeFrame(adult);
    const { bottom } = window_(frame);
    const headCenter = (adult.headY + adult.topY) / 2;
    expect((headCenter - bottom) / (2 * frame.half)).toBeGreaterThan(0.6);
  });

  it('scales to shorter models so the head keeps its proportion', () => {
    const child = { headY: 1.1, topY: 1.3 };
    const a = computeFrame(adult);
    const c = computeFrame(child);
    expect(c.half).toBeLessThan(a.half);
    expect(window_(c).top).toBeGreaterThan(child.topY);
    expect(window_(c).bottom).toBeLessThan(
      child.headY - 0.3 * (child.topY - child.headY),
    );
  });

  it('centers horizontally on the head and survives degenerate input', () => {
    expect(computeFrame({ ...adult, headX: 0.05 }).centerX).toBeCloseTo(0.05);
    const frame = computeFrame({ headY: 1.5, topY: 1.4 });
    expect(Number.isFinite(frame.half)).toBe(true);
    expect(frame.half).toBeGreaterThan(0);
  });
});

describe('measureFrame', () => {
  it('reads the head bone and the model top from the loaded object', () => {
    const root = new Group();
    const bone = new Object3D();
    bone.name = 'DEF-spine006';
    bone.position.set(0, 1.5, 0);
    root.add(bone);
    const body = new Mesh(new BoxGeometry(0.5, 1.85, 0.3));
    body.position.y = 0.925;
    root.add(body);
    root.position.x = 4; // slot offset
    const frame = measureFrame(root, 4);
    expect(frame).not.toBeNull();
    expect(frame?.centerX).toBeCloseTo(0);
    expect(frame!.centerY + frame!.half).toBeGreaterThan(1.85);
  });

  it('returns null without a head bone so the default framing stays', () => {
    expect(measureFrame(new Group(), 0)).toBeNull();
  });
});
