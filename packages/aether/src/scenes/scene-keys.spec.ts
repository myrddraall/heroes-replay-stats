import { describe, expect, it } from 'vitest';
import { EMPTY_LIBRARY, type LibraryState } from '../library/library';
import { DEFAULT_ORBIT, type PlanetChoices } from './scene-settings';
import { keyedScene } from './scene-keys';

const library: LibraryState = {
  ...EMPTY_LIBRARY,
  moons: { korhal: [{ id: 'rock', key: 'moon-1', orbit: DEFAULT_ORBIT }] },
};

const kept: PlanetChoices = {
  bodies: [
    {
      id: 'korhal',
      position: [0, 65, 4],
      radius: 18,
      moons: [{ id: 'ice', orbit: DEFAULT_ORBIT }],
    },
    { id: 'korhal', position: [30, 65, 4], radius: 9 },
  ],
  groups: [{ group: 'group-1', position: [0, 80, 0] }],
  sceneVariants: [
    {
      id: 'variant-1',
      name: 'Storm',
      switches: { '0.1': { storm: true }, '1': { calm: true }, '9': { gone: true } },
    },
  ],
  cameras: [
    {
      id: 'camera-a',
      name: 'Camera 1',
      eye: [0, 0, 0],
      forward: [0, 1, 0],
      fovY: 40,
      placement: { about: 1 as unknown as string, mode: 'over' },
    },
  ],
};

describe('a scene kept before its bodies had keys', () => {
  it('gives its planets, their own moons and its groups keys, in order, the same each time', () => {
    const keyed = keyedScene(kept, library);
    expect(keyed.bodies?.map((b) => b.key)).toEqual(['body-1', 'body-3']);
    expect(keyed.bodies?.[0]?.moons?.[0]?.key).toBe('body-2');
    expect(keyed.groups?.[0]?.key).toBe('place-1');
    expect(keyedScene(kept, library)).toEqual(keyed);
    // Kept since: as it is.
    expect(keyedScene(keyed, library)).toEqual(keyed);
  });

  it('points what pointed at a body by its place at its key, its planet’s own moons first among its moons', () => {
    const keyed = keyedScene(kept, library);
    expect(keyed.sceneVariants?.[0]?.switches).toEqual({
      'body-1.body-2': { storm: true },
      'body-3': { calm: true },
    });
    expect(keyed.cameras?.[0]?.placement?.about).toBe('body-3');
  });
});
