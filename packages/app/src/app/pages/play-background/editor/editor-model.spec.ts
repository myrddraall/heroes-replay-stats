import { describe, expect, it } from 'vitest';
import type { SceneMaterial } from '../../../scenes/play-background/play-scene';
import type { BodyPart, PlanetFile } from '../../../scenes/play-background/scene-planets';
import {
  type BodyInfo,
  lightMarkerAt,
  materialAt,
  materialsOf,
  offPart,
  onPart,
  sharedMaterials,
  shieldLightsOfBody,
} from './editor-model';

const material: SceneMaterial = {
  blend: 'alpha',
  unshaded: true,
  vertexAlpha: false,
  vertexColor: false,
  emissiveMult: 1,
  diffuse: { texture: 'clouds', brightMult: 1 },
  emissive: null,
  alphaMasks: [],
};

const file = (kind: PlanetFile['kind']): PlanetFile =>
  ({
    kind,
    parts: [
      {
        id: 'sphere-1',
        role: 'sphere',
        materials: ['clouds'],
        shape: { kind: 'sphere', radius: 1 },
        mapping: { kind: 'sphere' },
      } as unknown as BodyPart,
    ],
    materials: { clouds: material },
    textures: {},
  }) as PlanetFile;

const korhal = (settings: BodyInfo['settings']): BodyInfo => ({
  key: 'body',
  id: 'korhal',
  overlays: [{ id: '@overlay-1', file: file('style') }],
  overlaysSet: false,
  settings,
  materialBase: { clouds: { scale: 3 } },
  file: file('world'),
  moons: [],
});

describe('editor model', () => {
  it("sets a body's own material and an overlay's of the same name apart", () => {
    const list = materialsOf(
      korhal({
        materials: { clouds: { strength: 2 }, 'style:@overlay-1:clouds': { strength: 4 } },
      }),
    );
    const own = materialAt(list, 'clouds');
    const worn = materialAt(list, 'style:@overlay-1:clouds');
    expect(own?.overlay).toBeUndefined();
    expect(worn?.overlay).toBe('@overlay-1');
    expect(own?.values.strength).toBe(2);
    expect(worn?.values.strength).toBe(4);
    // The material's base settings are both's.
    expect(own?.values.scale).toBe(3);
    expect(worn?.values.scale).toBe(3);
  });

  it('keeps an overlay opened on its own by its key', () => {
    const list = materialsOf({
      ...korhal({ materials: { 'style:@overlay-1:clouds': { strength: 4 } } }),
      id: '@overlay-1',
      overlays: [],
      file: file('style'),
    });
    expect(list.map((m) => m.key)).toEqual(['style:@overlay-1:clouds']);
    expect(list[0]?.values.strength).toBe(4);
  });
});

describe('a material’s rows on parts', () => {
  it('tells apart by part only the materials drawn on more than one part', () => {
    const shared = sharedMaterials([
      { materials: [{ name: 'rock' }, { name: 'glow' }, { name: 'glow' }] },
      { materials: [{ name: 'rock' }] },
      { materials: [{ name: 'sea' }] },
    ]);
    expect([...shared]).toEqual(['rock']);
  });

  it('keeps the material’s name in its key, the part after it', () => {
    const key = onPart('body:0/m/rock', 'own:tube-1');
    expect(key).toBe('body:0/m/rock#own:tube-1');
    expect(offPart(key.slice('body:0/m/'.length))).toBe('rock');
    expect(onPart('body:0/m/rock')).toBe('body:0/m/rock');
    expect(offPart('rock')).toBe('rock');
  });
});

describe('a light’s marker', () => {
  // A body a radius wide at 10 ahead of an eye at the origin looking along +y.
  const body = { id: 'b', position: [0, 10, 0] as const, radius: 1 };
  const eye = [0, 0, 0] as const;

  it('puts a spot’s line along its aim to where it meets the body, past it to its nearest point', () => {
    // Straight in front, aimed at the middle: the line ends at the near surface.
    const at = lightMarkerAt({ kind: 'spot', position: [0, -3, 0] }, body, eye)!;
    expect(at.at.map((v) => Math.round(v * 100) / 100)).toEqual([0, 7, 0]);
    expect(at.from!.map((v) => Math.round(v * 100) / 100)).toEqual([0, 9, 0]);
    // Aimed up, past the body: as far as level with its middle.
    const past = lightMarkerAt({ kind: 'spot', position: [0, -3, 2], aim: [0, 1, 0] }, body, eye)!;
    expect(past.from!.map((v) => Math.round(v * 100) / 100)).toEqual([0, 10, 2]);
    // A point light's line goes to the nearest of the surface.
    const point = lightMarkerAt({ kind: 'point', position: [0, -3, 2] }, body, eye)!;
    expect(Math.hypot(point.from![0], point.from![1] - 10, point.from![2])).toBeCloseTo(1.05);
  });
});

describe('shieldLightsOfBody', () => {
  const shield = (): PlanetFile =>
    ({
      kind: 'style',
      parts: [
        {
          id: 'shield-1',
          role: 'shield',
          materials: ['grid'],
          shape: { kind: 'sphere', radius: 1 },
          mapping: { kind: 'sphere' },
          pattern: { kind: 'hex' },
        } as unknown as BodyPart,
      ],
      materials: { grid: material },
      textures: {},
    }) as PlanetFile;
  const worn = (): BodyInfo => ({
    key: 'body',
    id: 'korhal',
    overlays: [{ id: '@overlay-1', file: shield() }],
    overlaysSet: false,
    settings: {},
    file: file('world'),
    moons: [],
  });

  it("marks a shield's lights under the shield's material row, with the body's own lights", () => {
    const lights = shieldLightsOfBody(worn(), materialsOf(worn()), (name, overlay) =>
      overlay ? `om/${overlay}/${name}` : `m/${name}`,
    );
    expect(lights.map((l) => l.key)).toEqual(['om/@overlay-1/grid::light:added-rim']);
    expect(lights[0]?.light.kind).toBe('rim');
  });

  it('marks nothing where a body has no shield', () => {
    const b = { ...worn(), overlays: [] };
    expect(shieldLightsOfBody(b, materialsOf(b), (name) => name)).toEqual([]);
  });
});
