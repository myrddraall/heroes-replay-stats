import { describe, expect, it } from 'vitest';
import { layerBrightness, projectionMatrix, viewMatrix } from './scene-renderer';

/** A point through a column-major matrix, divided by w: normalized device coordinates. */
function transform(m: Float32Array, [x, y, z]: [number, number, number]): [number, number, number] {
  const out = [0, 1, 2, 3].map((r) => m[r]! * x + m[4 + r]! * y + m[8 + r]! * z + m[12 + r]!);
  return [out[0]! / out[3]!, out[1]! / out[3]!, out[2]! / out[3]!];
}

describe('the camera', () => {
  // The Play screen's: behind the floor, looking along +y, tilted down a little, z up.
  const eye: [number, number, number] = [0, -41.2, 5.6];
  const forward: [number, number, number] = [0, 0.9997, -0.025];
  const view = viewMatrix(eye, forward, [0, 0, 1]);
  const projection = projectionMatrix(43, 2.4, 0.3762, 185);
  const project = (p: [number, number, number]) => transform(projection, transform(view, p));

  it('puts what it looks at in the middle of the screen', () => {
    const [x, y] = project([
      eye[0] + forward[0] * 100,
      eye[1] + forward[1] * 100,
      eye[2] + forward[2] * 100,
    ]);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });

  it('keeps x to the right and z up', () => {
    expect(project([10, 40, 5.6 - 2])[0]).toBeGreaterThan(0);
    expect(project([0, 40, 30])[1]).toBeGreaterThan(0);
  });

  it('keeps its vertical field of view whatever the width: the edge of a 43° view is the top of the screen', () => {
    const up = Math.tan((21.5 * Math.PI) / 180);
    const top = transform(projectionMatrix(43, 0.5, 0.1, 100), [0, up * 10, -10]);
    expect(top[1]).toBeCloseTo(1);
  });
});

describe('layerBrightness', () => {
  it('squares the data multiplier', () => {
    expect(layerBrightness(0.3)).toBeCloseTo(0.09);
    expect(layerBrightness(1)).toBe(1);
  });
});
