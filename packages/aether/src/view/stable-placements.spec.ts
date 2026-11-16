import { describe, expect, it } from 'vitest';
import type { LoadedPlanet } from '../formats/planet-loader';
import type { PlanetPlacement } from '../space/space';
import { keepUnchanged, sameData, samePlacement } from './stable-placements';

const korhal = { id: 'korhal' } as unknown as LoadedPlanet;
const azeroth = { id: 'azeroth' } as unknown as LoadedPlanet;
const at = (planet: LoadedPlanet, strength = 1): PlanetPlacement => ({
  planet,
  position: [0, 10, 0],
  radius: 1,
  materials: { clouds: { strength } },
});

describe('placements kept where unchanged', () => {
  it('compares data throughout, undefined keys as left out', () => {
    expect(sameData({ a: [1, { b: 2 }], c: undefined }, { a: [1, { b: 2 }] })).toBe(true);
    expect(sameData({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
  });

  it('tells planets apart by the one loaded, the rest by data', () => {
    expect(samePlacement(at(korhal), at(korhal))).toBe(true);
    expect(samePlacement(at(korhal), at(azeroth))).toBe(false);
    expect(samePlacement(at(korhal), at(korhal, 2))).toBe(false);
  });

  it('keeps each unchanged one, and the list where none changed', () => {
    const before = [at(korhal), at(azeroth)];
    expect(keepUnchanged(before, [at(korhal), at(azeroth)])).toBe(before);
    const edited = keepUnchanged(before, [at(korhal), at(azeroth, 2)]);
    expect(edited).not.toBe(before);
    expect(edited[0]).toBe(before[0]);
    expect(edited[1]).not.toBe(before[1]);
  });
});
