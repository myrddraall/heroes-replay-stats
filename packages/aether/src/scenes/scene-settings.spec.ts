import { describe, expect, it } from 'vitest';
import {
  addMoon,
  changeMoon,
  DEFAULT_ORBIT,
  fitRadius,
  fitScene,
  moonAt,
  type MoonChoices,
  orbitOffset,
  orbitTo,
  pathKey,
  pathOf,
  placeBodies,
} from './scene-settings';
import type { Vec3 } from '../space/vectors';
import type { Viewpoint } from '../space/space';

const eye: Vec3 = [0, -41.2, 5.6];
/** The Play screen's camera: looking along +y, tilted down a little, z up. */
const view = { eye, forward: [0, 0.9997, -0.025], up: [0, 0, 1] } as const;
const root = { position: [0, 65, 4] as Vec3, radius: 18 };
const moon = (id: string, progress: number, moons?: MoonChoices[]): MoonChoices => ({
  id,
  orbit: { ...DEFAULT_ORBIT, tilt: 0, progress },
  moons,
});

describe('the scene’s moons', () => {
  it('are found, changed, added and taken out by their path', () => {
    let moons: readonly MoonChoices[] = [moon('a', 0), moon('b', 0, [moon('c', 0)])];
    expect(moonAt(moons, [1, 0])?.id).toBe('c');
    expect(moonAt(moons, [])).toBeUndefined();
    moons = changeMoon(moons, [1, 0], (m) => ({ ...m, style: 'nexus' }));
    expect(moonAt(moons, [1, 0])?.style).toBe('nexus');
    moons = addMoon(moons, [0], moon('d', 0));
    expect(moonAt(moons, [0, 0])?.id).toBe('d');
    moons = changeMoon(moons, [1], () => null);
    expect(moons.map((m) => m.id)).toEqual(['a']);
    expect(pathOf(pathKey([1, 0, 2]))).toEqual([1, 0, 2]);
    expect(pathOf('')).toEqual([]);
  });

  it('go round their orbit: right, behind, left, in front', () => {
    const at = (progress: number) =>
      orbitOffset({ ...DEFAULT_ORBIT, tilt: 0, radius: 2, progress });
    expect(at(0).map((v) => +v.toFixed(6) + 0)).toEqual([2, 0, 0]);
    expect(at(0.25)[1]).toBeCloseTo(2);
    expect(at(0.5)[0]).toBeCloseTo(-2);
    expect(at(0.75)[1]).toBeCloseTo(-2);
    // Tilted, the far side rises.
    expect(orbitOffset({ ...DEFAULT_ORBIT, tilt: 30, radius: 2, progress: 0.25 })[2]).toBeCloseTo(
      1,
    );
  });

  it('are placed about their parents, their size a share of their parent’s', () => {
    const bodies = placeBodies(root, [moon('a', 0, [moon('b', 0.5)])], view);
    expect(bodies.map((b) => pathKey(b.path))).toEqual(['', '0', '0.0']);
    const [planet, a, b] = bodies;
    expect(a!.radius).toBeCloseTo(18 * DEFAULT_ORBIT.size);
    expect(a!.position[0]).toBeGreaterThan(planet!.position[0]); // to its right
    expect(b!.position[0]).toBeLessThan(a!.position[0]); // to the left of its own parent
  });

  it('are put on the orbit that places them where a body is, in front or behind, above or below', () => {
    for (const at of [
      [10, 40, 12],
      [-6, 80, -9],
      [25, 66, 4],
      [0, 50, 30],
    ] as Vec3[]) {
      const orbit = orbitTo(root, { position: at, radius: 3 }, view);
      expect(Math.abs(orbit.tilt)).toBeLessThanOrEqual(90);
      const [, placed] = placeBodies(root, [{ id: 'm', orbit }], view);
      placed!.position.forEach((v, k) => expect(v).toBeCloseTo(at[k]!, 4));
      expect(placed!.radius).toBeCloseTo(3);
    }
  });

  /** An eye on the planet's far side from the scene's camera, looking back at it. */
  const farEye: Vec3 = [0, 171.2, 5.6];

  it('stay where the scene puts them, passing behind or in front of their planet as the eye goes round', () => {
    // Placed from the scene's camera: behind the planet from there, in front of it from its far side.
    const [planet, a] = placeBodies(root, [moon('a', 0.25)], view);
    const from = (e: Vec3, b: { position: Vec3 }) =>
      Math.hypot(b.position[0] - e[0], b.position[1] - e[1], b.position[2] - e[2]);
    expect(from(eye, a!)).toBeGreaterThan(from(eye, planet!));
    expect(from(farEye, a!)).toBeLessThan(from(farEye, planet!));
  });
});

describe('the scene fitted to the view', () => {
  const reach = { across: 0.4, up: 0.4 };

  it('keeps the planet as it is when everything is in view', () => {
    expect(fitRadius({ ...root, radius: 10 }, [], view, reach)).toBe(10);
  });

  it('makes the planet smaller where a moon would leave the view', () => {
    const far = [{ id: 'a', orbit: { ...DEFAULT_ORBIT, tilt: 0, radius: 5, progress: 0 } }];
    const r = fitRadius(root, far, view, reach);
    expect(r).toBeLessThan(root.radius);
    // As the eye sees it, the moon's far edge stays within the view, in front of the planet too.
    for (const progress of [0, 0.9]) {
      const orbit = { ...DEFAULT_ORBIT, tilt: 0, radius: 5, progress };
      const moons = [{ id: 'a', orbit }];
      const fitted = fitRadius(root, moons, view, reach);
      const moon = placeBodies({ ...root, radius: fitted }, moons, view)[1]!;
      const depth = moon.position[1] - eye[1];
      expect((Math.abs(moon.position[0] - eye[0]) + moon.radius) / depth).toBeLessThanOrEqual(
        reach.across,
      );
    }
  });

  it('draws a scene of several planets smaller about the middle where one would leave the view', () => {
    const camera = { eye: [0, 0, 0] as const, forward: [0, 1, 0] as const, up: [0, 0, 1] as const };
    const reach = { across: 0.5, up: 0.5 };
    const inView = [{ position: [5, 100, 0] as const, radius: 5 }];
    expect(fitScene(inView, [1], camera, reach)).toEqual(inView);
    const wide = [
      { position: [0, 100, 0] as const, radius: 10 },
      { position: [60, 100, 0] as const, radius: 10 },
    ];
    const fitted = fitScene(wide, [1.2, 1.2], camera, reach);
    // Now within the view (its margin): across, 60·s + 12·s ≤ 0.85 · 0.5 · 100.
    const [, right] = fitted;
    expect(right!.position[0] + right!.radius * 1.2).toBeCloseTo(42.5, 5);
    // Its distance kept, the first still in the middle.
    expect(right!.position[1]).toBeCloseTo(100, 5);
    expect(fitted[0]!.position[0]).toBeCloseTo(0, 5);
  });
});

/** The game's camera, as the Play scene's file has it: the scene's own. */
const LAYOUT: Viewpoint = {
  eye: [-0.0018, -41.1988, 5.6051],
  forward: [1.9e-5, 0.999687, -0.025004],
  up: [0, 0, 1],
};
const expectNear = (got: ArrayLike<number>, want: ArrayLike<number>, digits = 9) => {
  expect(got.length).toBe(want.length);
  for (let i = 0; i < want.length; i++) expect(got[i]).toBeCloseTo(want[i]!, digits);
};
describe("a moon's orbit", () => {
  it('finds the orbit back that places a moon where it is (untilted on the screen)', () => {
    const root = { position: [12, 66, 3] as Vec3, radius: 9 };
    const orbit = { radius: 2.2, tilt: 25, turn: 0, progress: 0.3, size: 0.2 };
    const [, moon] = placeBodies(root, [{ id: 'm', orbit }], LAYOUT);
    const found = orbitTo(root, moon!, LAYOUT);
    const [, again] = placeBodies(root, [{ id: 'm', orbit: found }], LAYOUT);
    // (Its frames are 32-bit floats.)
    expectNear(again!.position, moon!.position, 5);
    expect(found.size).toBeCloseTo(0.2, 12);
  });
});
