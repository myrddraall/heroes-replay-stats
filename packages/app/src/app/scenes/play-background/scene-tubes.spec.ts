import { describe, expect, it } from 'vitest';
import type { SceneMesh } from './play-scene';
import { fitTube, tubeCover } from './scene-tubes';

/** A many-sided cylinder (or a funnel, its top `top` times as wide) as the game models one, its texture round and up it. */
function cylinder(sides: number, radius: number, top = 1): SceneMesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    for (const [z, r, v] of [
      [-90, radius, 1],
      [90, radius * top, 0],
    ] as const) {
      positions.push(1 + r * Math.cos(a), -3 + r * Math.sin(a), z);
      // Round it the other way from the angle, starting a quarter round (as the star cylinder's).
      uvs.push(0.75 - i / sides, v);
    }
  }
  return { positions, uvs, colors: [], indices: [], materials: [] };
}

describe('a sky mesh as a tube', () => {
  it('is the exact tube a many-sided cylinder stands for, its texture as the mesh has it', () => {
    const tube = fitTube(cylinder(32, 95))!;
    expect(tube.centre[0]).toBeCloseTo(1, 3);
    expect(tube.centre[1]).toBeCloseTo(-3, 3);
    // Its corners are on the circle (the facets' middles fall inside it).
    expect(tube.radius).toBeCloseTo(95, 3);
    expect(tube.u[0]).toBeCloseTo(-1, 3);
    expect(tube.v[0]).toBeCloseTo(-1 / 180, 5);
    expect(tube.v[1]).toBeCloseTo(0.5, 5);
  });

  it('is none for what isn’t a tube: a funnel, a few points', () => {
    expect(fitTube(cylinder(32, 95, 0.5))).toBeNull();
    expect(
      fitTube({ positions: [0, 0, 0], uvs: [0, 0], colors: [], indices: [], materials: [] }),
    ).toBeNull();
  });

  it('is drawn on a cover round and past it: its sides’ middles outside it, past its ends', () => {
    const tube = fitTube(cylinder(32, 95))!;
    expect(tube.low).toBeCloseTo(-90);
    expect(tube.high).toBeCloseTo(90);
    const cover = tubeCover(tube);
    const n = cover.positions.length / 3;
    for (let i = 0; i < cover.indices.length; i += 3) {
      // Each side's middle (between two corners at a height) outside the tube.
      const [a, b] = [cover.indices[i]!, cover.indices[i + 2]!];
      const mx = (cover.positions[a * 3]! + cover.positions[b * 3]!) / 2 - tube.centre[0];
      const my = (cover.positions[a * 3 + 1]! + cover.positions[b * 3 + 1]!) / 2 - tube.centre[1];
      expect(Math.hypot(mx, my)).toBeGreaterThan(tube.radius);
    }
    const zs = Array.from({ length: n }, (_, i) => cover.positions[i * 3 + 2]!);
    expect(Math.min(...zs)).toBeLessThan(tube.low);
    expect(Math.max(...zs)).toBeGreaterThan(tube.high);
  });
});
