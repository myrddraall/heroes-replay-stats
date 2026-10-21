import { describe, expect, it } from 'vitest';
import { beamAcross, beamTube } from './scene-beams';

const dot = (a: readonly number[], b: readonly number[]) =>
  a.reduce((sum, v, i) => sum + v * b[i]!, 0);

describe('a light’s beam', () => {
  it('is a tube of triangles round its way, from the body (0) to its far end (1)', () => {
    const tube = beamTube(4);
    expect(tube.length).toBe(4 * 6 * 3);
    const along = [...tube].filter((_, i) => i % 3 === 2);
    expect(new Set(along)).toEqual(new Set([0, 1]));
    for (let i = 0; i < tube.length; i += 3)
      expect(Math.hypot(tube[i]!, tube[i + 1]!)).toBeCloseTo(1);
  });

  it('is put round its way by two ways square to it and to each other', () => {
    for (const from of [
      [0, 0, 1],
      [1, 0, 0],
      [-0.55, -0.45, 0.7],
    ] as const) {
      const [across, up] = beamAcross(from);
      expect(dot(across, from)).toBeCloseTo(0);
      expect(dot(up, from)).toBeCloseTo(0);
      expect(dot(across, up)).toBeCloseTo(0);
      expect(Math.hypot(...across)).toBeCloseTo(1);
      expect(Math.hypot(...up)).toBeCloseTo(1);
    }
  });
});
