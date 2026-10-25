import { describe, expect, it } from 'vitest';
import {
  type CreatedOverlay,
  createdPlanetFile,
  createdSkyFile,
  lookupIn,
  sourceFiles,
  withUnused,
} from './created-overlays';
import type { PlayScene, SceneMaterial } from '../../formats/play-scene';
import type { PlanetFile } from '../../formats/planets';

const material = (texture: string) =>
  ({ diffuse: { texture }, alphaMasks: [] }) as unknown as SceneMaterial;

const korhal = {
  kind: 'planet',
  parts: [],
  materials: { Clouds: material('clouds') },
  textures: {
    clouds: { file: 'clouds.webp', width: 1, height: 1 },
    other: { file: 'other.webp', width: 1, height: 1 },
  },
} as unknown as PlanetFile;

const scene = {
  materials: { Haze: material('haze') },
  textures: { haze: { file: 'haze.webp', width: 1, height: 1 } },
} as unknown as PlayScene;

const made: CreatedOverlay = {
  kind: 'planet',
  label: 'Overlay 1',
  parts: [{ id: 'sphere-1', shape: 'sphere', materials: ['Clouds', 'Haze', 'Gone'] }],
  sources: {
    Clouds: { kind: 'planet', id: 'korhal' },
    Haze: { kind: 'sky' },
    Gone: { kind: 'style', id: 'nexus' },
  },
};

describe('overlays made in the editor', () => {
  it('reads its materials where the game data has them, not copies', () => {
    const file = createdPlanetFile(made, lookupIn({ korhal }, scene));
    expect(file.materials['Clouds']).toBe(korhal.materials['Clouds']);
    expect(file.materials['Haze']).toBe(scene.materials['Haze']);
    // Only the textures its materials read.
    expect(Object.keys(file.textures).sort()).toEqual(['clouds', 'haze']);
  });

  it('leaves out a material not found (yet) where it is', () => {
    const file = createdPlanetFile(made, lookupIn({ korhal }, null));
    expect(Object.keys(file.materials)).toEqual(['Clouds']);
    expect(file.parts[0]!.materials).toEqual(['Clouds']);
  });

  it('needs the files its materials are in loaded', () => {
    expect(sourceFiles(made)).toEqual(['korhal', 'style-nexus']);
  });

  it("builds a sky's bands the same way", () => {
    const sky: CreatedOverlay = {
      kind: 'sky',
      label: 'Sky overlay 1',
      parts: [{ id: 'band-1', shape: 'band', materials: ['Haze'] }],
      sources: { Haze: { kind: 'sky' } },
    };
    const file = createdSkyFile(sky, lookupIn({}, scene));
    expect(file.parts.map((p) => p.materials)).toEqual([['Haze']]);
    expect(file.materials['Haze']).toBe(scene.materials['Haze']);
  });

  it('forgets where a material is once no part draws it', () => {
    const o = withUnused({ ...made, parts: [{ ...made.parts[0]!, materials: ['Clouds'] }] });
    expect(Object.keys(o.sources)).toEqual(['Clouds']);
  });
});
