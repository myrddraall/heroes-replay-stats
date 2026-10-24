import { describe, expect, it } from 'vitest';
import { beyondEdge, playSet, randomSet, seeded } from './planet-sets';
import { projectionMatrix, viewMatrix } from './scene-space';
import type { SceneCamera } from './play-scene';
import type { PlanetIndex } from './scene-planets';

const index: PlanetIndex = {
  planets: [
    { id: 'play-large', kind: 'play', style: 'nexus' },
    { id: 'play-medium', kind: 'play', style: 'nexus' },
    { id: 'play-small', kind: 'play', style: 'nexus' },
    { id: 'azeroth', kind: 'world' },
    { id: 'planet-1', kind: 'painted' },
    { id: 'planet-2', kind: 'painted' },
  ],
  play: [
    { id: 'play-large', position: [-48.2, 64.6, 25.4], radius: 27.3 },
    { id: 'play-medium', position: [37.3, 64.9, 14.2], radius: 9 },
    { id: 'play-small', position: [27.8, 53.8, 7.5], radius: 1.6 },
  ],
  styles: [{ id: 'nexus' }],
};

describe('planet sets', () => {
  it("are the game's own as the index has it", () => {
    expect(playSet(index).map((p) => p.id)).toEqual(['play-large', 'play-medium', 'play-small']);
  });

  it('put each planet in the style it wears of its own', () => {
    expect(playSet(index).every((p) => p.overlays?.join() === 'nexus')).toBe(true);
    for (let n = 1; n < 20; n++)
      for (const p of randomSet(index, seeded(n)))
        expect(p.overlays).toEqual(p.id.startsWith('play-') ? ['nexus'] : undefined);
  });

  it('come out the same from the same seed, and different from another', () => {
    expect(randomSet(index, seeded(7))).toEqual(randomSet(index, seeded(7)));
    const sets = new Set([1, 2, 3, 4, 5].map((n) => JSON.stringify(randomSet(index, seeded(n)))));
    expect(sets.size).toBeGreaterThan(1);
  });

  it('put each planet once, in a place that fits it, the large one on its own side', () => {
    for (let n = 1; n <= 200; n++) {
      const set = randomSet(index, seeded(n));
      expect(set.length).toBeGreaterThanOrEqual(1);
      expect(set.length).toBeLessThanOrEqual(3);
      expect(new Set(set.map((p) => p.id)).size).toBe(set.length);
      const [large, ...others] = set;
      expect(large!.id).not.toBe('play-small'); // a sphere, never the big hemisphere's place
      for (const other of others) {
        expect(other.id).not.toBe('play-large');
        expect(Math.sign(other.position[0])).toBe(-Math.sign(large!.position[0]));
        expect(other.radius).toBeLessThan(large!.radius);
      }
    }
  });

  it('keeps a planet on its own within the view, unless it is big', () => {
    let solos = 0;
    for (let n = 1; n <= 600; n++) {
      const set = randomSet(index, seeded(n));
      if (set.length !== 1) continue;
      solos++;
      const [p] = set;
      const over = (p!.radius / 30) * 0.7 * p!.radius + 0.01;
      const depth = p!.position[1] + 41.2;
      const halfWidth = depth * Math.tan((43 * Math.PI) / 360) * (16 / 9);
      expect(Math.abs(p!.position[0]) + p!.radius).toBeLessThanOrEqual(halfWidth + over);
      expect(p!.position[2] + p!.radius).toBeLessThanOrEqual(40 + over);
      expect(p!.position[2] - p!.radius).toBeGreaterThanOrEqual(-34 - over);
    }
    expect(solos).toBeGreaterThan(20);
  });

  it('puts a planet just beyond the edge of the view, whichever side and however the camera turns', () => {
    const camera: SceneCamera = {
      eye: [0, -41.2, 5.6],
      forward: [0, 0.9997, -0.025],
      up: [0, 0, 1],
      fovY: 43,
      near: 0.3762,
      far: 185,
    };
    const aspects = [16 / 9, 4 / 3, 21 / 9];
    const planets: [readonly [number, number, number], number][] = [
      [[-48, 65, 25], 27],
      [[37, 65, 14], 9],
      [[28, 54, 7.5], 1.6],
      [[10, 75, 30], 30],
    ];
    const turn = 0.11;
    for (const aspect of aspects)
      for (const [position, radius] of planets)
        for (const side of [-1, 1]) {
          const x = beyondEdge(position, radius, camera, aspect, side, turn, 1.3);
          // The camera turned that way as far as it may: the planet's nearest point is still past the edge.
          const yawed = viewMatrix(camera.eye, turnZ(camera.forward, -side * turn), camera.up);
          const projection = projectionMatrix(camera.fovY, aspect, camera.near, camera.far);
          const near: [number, number, number] = [x - side * radius, position[1], position[2]];
          const ndc = project(projection, yawed, near);
          expect(side * ndc).toBeGreaterThan(1);
          // And not absurdly far: within a couple of its radii of the edge.
          const far: [number, number, number] = [x - side * radius * 3, position[1], position[2]];
          expect(side * project(projection, yawed, far)).toBeLessThan(1);
        }
  });
});

/** A vector turned about z by an angle. */
function turnZ(v: readonly [number, number, number], angle: number): [number, number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}

/** A point's x in normalised device coordinates. */
function project(
  projection: Float32Array,
  view: Float32Array,
  p: [number, number, number],
): number {
  const mul = (m: Float32Array, v: number[]) =>
    [0, 1, 2, 3].map(
      (r) => m[r]! * v[0]! + m[4 + r]! * v[1]! + m[8 + r]! * v[2]! + m[12 + r]! * v[3]!,
    );
  const clip = mul(projection, mul(view, [...p, 1]));
  return clip[0]! / clip[3]!;
}
