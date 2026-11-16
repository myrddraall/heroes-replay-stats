import { describe, expect, it } from 'vitest';
import type { PlayScene, SceneMesh } from '../formats/play-scene';
import { skyDepths } from './sky-depths';

/** A box's mesh from `lo` to `hi`, its twelve triangles. */
function box(lo: number[], hi: number[], materials: string[], planet?: 'large'): SceneMesh {
  const positions: number[] = [];
  for (let i = 0; i < 8; i++)
    positions.push(i & 1 ? hi[0]! : lo[0]!, i & 2 ? hi[1]! : lo[1]!, i & 4 ? hi[2]! : lo[2]!);
  const faces = [
    [0, 1, 3, 2],
    [4, 5, 7, 6],
    [0, 1, 5, 4],
    [2, 3, 7, 6],
    [0, 2, 6, 4],
    [1, 3, 7, 5],
  ];
  return {
    positions,
    uvs: [],
    colors: [],
    indices: faces.flatMap(([a, b, c, d]) => [a!, b!, c!, a!, c!, d!]),
    materials,
    planet,
  };
}

/** A wall across the view at `y`, wide enough to meet every look at the planet. */
const wall = (y: number, material: string) => box([-50, y, -50], [50, y, 50], [material]);

const scene = (meshes: Record<string, SceneMesh>): PlayScene =>
  ({
    camera: { eye: [0, 0, 0], forward: [0, 1, 0], up: [0, 0, 1], fovY: 43, near: 0.1, far: 200 },
    meshes,
    materials: {},
    particles: [{ emitter: 'emitter', material: 'twinkle' }],
    textures: {},
  }) as unknown as PlayScene;

describe('the sky’s depths', () => {
  const found = skyDepths(
    scene({
      planet: box([-10, 90, -10], [10, 110, 10], ['surface'], 'large'),
      near: wall(50, 'energy'),
      far: wall(150, 'stars'),
      emitter: box([-40, 80, -40], [40, 130, 40], []),
      aside: box([200, 90, 0], [210, 110, 10], ['elsewhere']),
    }),
  );

  it('put what the data has in front of every planet in front of the objects', () => {
    expect(found['energy']).toBe('foreground');
  });

  it('put what the data has behind the planets behind every object', () => {
    expect(found['stars']).toBe('background');
    // Met nowhere about the planets: behind them too.
    expect(found['elsewhere']).toBe('background');
  });

  it('keep what the data has about the planets among them, particles by their emitter', () => {
    expect(found['twinkle']).toBe('scene');
  });

  it('leave the planets’ own materials out', () => {
    expect(found['surface']).toBeUndefined();
  });
});
