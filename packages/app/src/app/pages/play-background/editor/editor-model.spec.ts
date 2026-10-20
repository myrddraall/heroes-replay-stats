import { describe, expect, it } from 'vitest';
import type { SceneMaterial } from '../../../scenes/play-background/play-scene';
import type { BodyPart, PlanetFile } from '../../../scenes/play-background/scene-planets';
import { type BodyInfo, materialAt, materialsOf } from './editor-model';

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
    parts: [{ id: 'sphere-1', role: 'sphere', materials: ['clouds'] } as unknown as BodyPart],
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
