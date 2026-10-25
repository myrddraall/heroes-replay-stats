import { describe, expect, it } from 'vitest';
import { atLeast, orbitOffset, orbitThrough, overOf, overOffset } from './placement';

type Vec3 = readonly [number, number, number];

const expectAt = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 9));

describe('placement', () => {
  const places: Vec3[] = [
    [1.2, -1.2, 0.8],
    [0, -2.5, 1.5],
    [-2, 0.5, -1],
    [0, 0, 3],
    [0, 2, 0],
  ];

  it('finds the orbit through a place, keeping its turn', () => {
    for (const p of places)
      for (const turn of [0, 30, -75, 180]) {
        const orbit = orbitThrough(p, turn);
        expect(orbit.turn).toBe(turn);
        expect(Math.abs(orbit.tilt)).toBeLessThanOrEqual(90);
        expectAt(orbitOffset(orbit), p);
      }
  });

  it('gives back an orbit as it was set', () => {
    const orbit = { radius: 2.4, tilt: 12, turn: 20, progress: 0.9 };
    const back = orbitThrough(orbitOffset(orbit), orbit.turn);
    expect(back.radius).toBeCloseTo(2.4, 9);
    expect(back.tilt).toBeCloseTo(12, 9);
    expect(back.progress).toBeCloseTo(0.9, 9);
  });

  it('finds the spot and distance a place is over', () => {
    for (const p of places) expectAt(overOffset(overOf(p)), p);
    expect(overOf([0, 0, 3])).toEqual({ at: [0, 0, 1], distance: 3 });
  });

  it('keeps a place no nearer the middle than it may be', () => {
    expect(atLeast([0, -2, 0], 1)).toEqual([0, -2, 0]);
    expectAt(atLeast([0, 0, 0.5], 1), [0, 0, 1]);
    expectAt(atLeast([0, 0, 0], 1), [0, -1, 0]);
  });
});
