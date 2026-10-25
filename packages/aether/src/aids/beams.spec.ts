import { describe, expect, it } from 'vitest';
import { alongToSphere, beamAcross, beamTube, coneEdges } from './beams';

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

describe('a spot’s cone as seen', () => {
  it('reaches the unit sphere along a ray that meets it, else the ray’s nearest point to it', () => {
    // Straight at the middle from 3 radii out: the surface is 2 out.
    expect(alongToSphere([0, -3, 0], [0, 1, 0])).toBeCloseTo(2);
    // Past the sphere: as far as its nearest point (level with the middle).
    expect(alongToSphere([0, -3, 2], [0, 1, 0])).toBeCloseTo(3);
    // Pointing away: a little way, never backwards.
    expect(alongToSphere([0, -3, 0], [0, -1, 0])).toBe(0.5);
  });

  it('has two edges seen from the side, from the apex to the sphere, none seen from inside it', () => {
    const at = [0, -3, 0] as const;
    const aim = [0, 1, 0] as const;
    const edges = coneEdges(at, aim, 15, [4, -3, 0]);
    expect(edges).toHaveLength(2);
    for (const [from, to] of edges) {
      expect(from).toEqual(at);
      // Each edge leans 15 degrees off the aim, and ends on the sphere.
      const way = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
      const length = Math.hypot(...way);
      expect(Math.acos(way[1]! / length) * (180 / Math.PI)).toBeCloseTo(15, 5);
      expect(Math.hypot(...to)).toBeCloseTo(1, 5);
    }
    // Seen from beside the apex, the edges are the cone's top and bottom; from above, its sides.
    expect(edges.map(([, to]) => Math.abs(to[2]!) > 0.1)).toEqual([true, true]);
    expect(coneEdges(at, aim, 15, [0, -3, 4]).map(([, to]) => Math.abs(to[0]!) > 0.1)).toEqual([
      true,
      true,
    ]);
    expect(coneEdges(at, aim, 15, [0, 0, 0])).toEqual([]);
  });
});
