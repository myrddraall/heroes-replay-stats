import { describe, expect, it } from 'vitest';
import type { SceneCamera } from './play-scene';
import {
  cameraAngles,
  cameraOutline,
  dolly,
  fieldOfView,
  forwardOf,
  orbit,
  pan,
  viewLine,
  viewPoint,
} from './scene-camera';

const camera: SceneCamera = {
  eye: [0, 0, 0],
  forward: [0, 1, 0],
  up: [0, 0, 1],
  fovY: 40,
  near: 1,
  far: 1000,
};

describe('a scene’s camera', () => {
  it('turns and tilts the way it looks, and back', () => {
    expect(cameraAngles([0, 1, 0])).toEqual({ turn: 0, tilt: 0 });
    expect(cameraAngles([1, 0, 0]).turn).toBeCloseTo(90);
    const f = forwardOf(30, 10);
    const back = cameraAngles(f);
    expect(back.turn).toBeCloseTo(30);
    expect(back.tilt).toBeCloseTo(10);
  });

  it('orbits round what it looks at', () => {
    const moved = orbit(camera, 50, 90, 0);
    // A quarter turn round the point 50 ahead: from its left, looking right (+x).
    expect(moved.eye![0]).toBeCloseTo(-50);
    expect(moved.eye![1]).toBeCloseTo(50);
    expect(moved.forward![0]).toBeCloseTo(1);
  });

  it('pans across the view, and moves in no nearer than it may', () => {
    expect(pan(camera, 10, 5).eye).toEqual([10, 0, 5]);
    expect(dolly(camera, 50, 20).eye).toEqual([0, 20, 0]);
    expect(dolly(camera, 50, 100).eye).toEqual([0, 48, 0]);
  });

  it('keeps its field of view to what it can show', () => {
    expect(fieldOfView(1)).toBe(5);
    expect(fieldOfView(200)).toBe(120);
  });
});

describe('a view through a camera', () => {
  it('shows what is straight ahead in its middle, and nothing behind it', () => {
    const middle = viewPoint(camera, 16 / 9, [0, 10, 0])!;
    expect(middle.x).toBeCloseTo(0.5);
    expect(middle.y).toBeCloseTo(0.5);
    expect(middle.depth).toBeCloseTo(10);
    expect(viewPoint(camera, 16 / 9, [0, -10, 0])).toBeNull();
    // Right and up of the middle: right of it, above it (y down the view).
    const p = viewPoint(camera, 1, [1, 10, 1])!;
    expect(p.x).toBeGreaterThan(0.5);
    expect(p.y).toBeLessThan(0.5);
  });

  it('cuts a line where it passes behind the camera', () => {
    const line = viewLine(camera, 1, [0, -10, 0], [1, 10, 0])!;
    expect(line).not.toBeNull();
    expect(line[0].depth).toBeCloseTo(0.05);
    expect(viewLine(camera, 1, [0, -10, 0], [0, -5, 0])).toBeNull();
  });

  it('outlines what a camera sees at the edges of its view', () => {
    const lines = cameraOutline(camera, 1, 10);
    expect(lines).toHaveLength(8);
    // A corner ahead shows at the corner of the camera's own view.
    const corner = viewPoint(camera, 1, lines[0]![1])!;
    expect(corner.x).toBeCloseTo(0);
    expect(corner.y).toBeCloseTo(0);
  });
});
