import { describe, expect, it } from 'vitest';
import { type BodyPart, DEFAULT_SHADE, type PlanetFile } from '../formats/planet-files';
import type { LoadedPlanet } from '../formats/planet-loader';
import type { SceneMaterial } from '../formats/play-scene';
import type { PlanetPlacement } from '../space/space';
import { drawnBody } from './drawn-body';

const material = { blend: 'alpha', alphaMasks: [] } as unknown as SceneMaterial;
const part = (role: BodyPart['role'], materials: string[]) =>
  ({
    id: role,
    role,
    materials,
    shape: { kind: 'sphere', radius: 1 },
    mapping: { kind: 'sphere', pole: [0, 0, 1] },
  }) as unknown as BodyPart;
const loaded = (id: string, file: Partial<PlanetFile>): LoadedPlanet => ({
  id,
  planet: { kind: 'world', parts: [], materials: {}, textures: {}, ...file } as PlanetFile,
  images: {},
});

const planet = loaded('korhal', {
  parts: [part('surface', ['rock'])],
  materials: { rock: material },
  tuning: {
    materials: { rock: { strength: 0.5, glow: 2 } },
    variants: { storm: { materials: { haze: { strength: 0.3 } }, shade: { strength: 0.2 } } },
    tints: [{ id: 'red', kind: 'colour', colour: '#ff0000', blend: 'multiply', strength: 1 }],
  },
});
const storm = loaded('style-storm', {
  kind: 'style',
  parts: [part('layer', ['haze'])],
  materials: { haze: material },
  shade: { ...DEFAULT_SHADE, strength: 0.6 },
  tuning: { materials: { haze: { glow: 3, strength: 0.9 } } },
});

describe('a body as drawn', () => {
  it('gives each material its settings: its file’s, its wear, the base, its own', () => {
    const body = drawnBody({
      planet,
      overlays: [storm],
      position: [0, 0, 0],
      radius: 1,
      materials: { rock: { glow: 1 }, 'style:storm:haze': { scale: 4 } },
      base: { haze: { strength: 0.1 } },
    });
    expect(body.draws.map((d) => [d.key, d.settings])).toEqual([
      ['rock', { strength: 0.5, glow: 1 }],
      ['style:storm:haze', { glow: 3, strength: 0.1, scale: 4 }],
    ]);
    expect(body.draws[1]!.overlay).toBe('storm');
  });

  it('takes its tuning’s values where it sets none, and its shade level over level', () => {
    const placement: PlanetPlacement = {
      planet,
      overlays: [storm],
      position: [0, 0, 0],
      radius: 1,
    };
    const body = drawnBody(placement);
    expect(body.tints).toEqual(planet.planet.tuning!.tints);
    expect(body.shade.strength).toBe(0.2);
    expect(drawnBody({ ...placement, shade: { strength: 0.7 } }).shade.strength).toBe(0.7);
    // The same placement, the same body.
    expect(drawnBody(placement)).toBe(body);
  });

  it('leaves out a part switched off, as shown', () => {
    const body = drawnBody({
      planet,
      position: [0, 0, 0],
      radius: 1,
      parts: { 'own:surface': { enabled: false } },
    });
    expect(body.draws[0]!.partShown).toBe(false);
  });
});
