import type {
  BodyPart,
  PlanetFile,
  SceneMaterial,
} from '@myrddraall/heroes-replay-stats-aether/formats';
import { type BodyInfo } from './body';
/** Test data for the editors' model functions' specs: a material, a planet file, a body. */

export const material: SceneMaterial = {
  blend: 'alpha',
  unshaded: true,
  vertexAlpha: false,
  vertexColor: false,
  emissiveMult: 1,
  diffuse: { texture: 'clouds', brightMult: 1 },
  emissive: null,
  alphaMasks: [],
};

export const file = (kind: PlanetFile['kind']): PlanetFile =>
  ({
    kind,
    parts: [
      {
        id: 'sphere-1',
        role: 'sphere',
        materials: ['clouds'],
        shape: { kind: 'sphere', radius: 1 },
        mapping: { kind: 'sphere', pole: [0, 0, 1] },
      } as unknown as BodyPart,
    ],
    materials: { clouds: material },
    textures: {},
  }) as PlanetFile;

export const korhal = (settings: BodyInfo['settings']): BodyInfo => ({
  key: 'body',
  id: 'korhal',
  overlays: [{ id: '@overlay-1', file: file('style') }],
  overlaysSet: false,
  settings,
  materialBase: { clouds: { scale: 3 } },
  file: file('world'),
  moons: [],
});
