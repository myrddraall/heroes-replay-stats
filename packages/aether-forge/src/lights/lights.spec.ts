import { describe, expect, it } from 'vitest';
import type { BodyPart, PlanetFile } from '@myrddraall/heroes-replay-stats-aether/formats';
import { type BodyInfo } from '../bodies/body';
import { shieldLightsOfBody } from './lights';
import { materialsOf } from '../materials/materials';
import { file, material } from '../bodies/body-fixtures';

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
