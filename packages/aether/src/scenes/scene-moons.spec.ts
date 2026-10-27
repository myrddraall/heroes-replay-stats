import { describe, expect, it } from 'vitest';
import { DEFAULT_ORBIT, type MoonChoices, placeBodies, type SceneBody } from './scene-settings';
import { EMPTY_LIBRARY, type LibraryState } from '../library/library';
import {
  inheritedMoons,
  libraryMoonsOf,
  resetMoon,
  setWithMoons,
  storedBodies,
  withLibraryMoons,
} from './scene-moons';
import { setOrbit, changeSettings, sceneBodies } from './scene-bodies';
import { setOverlays } from './body-overlays';

const korhal: SceneBody = { id: 'korhal', position: [0, 65, 4], radius: 18 };

describe("a planet's own moons", () => {
  const rock: MoonChoices = {
    id: 'rock',
    key: 'moon-1',
    orbit: DEFAULT_ORBIT,
    overlays: ['nexus'],
  };
  const ice: MoonChoices = {
    id: 'ice',
    key: 'moon-2',
    orbit: { ...DEFAULT_ORBIT, radius: 4 },
    moons: [{ id: 'dust', key: 'moon-3', orbit: DEFAULT_ORBIT }],
  };
  const library: LibraryState = { ...EMPTY_LIBRARY, moons: { korhal: [rock, ice] } };
  const own: MoonChoices = { id: 'planet-1', orbit: DEFAULT_ORBIT };

  it("reads them among a scene body's moons first, marked by key, the scene's own after", () => {
    const [read] = withLibraryMoons([{ ...korhal, moons: [own] }], library);
    expect(read?.moons?.map((m) => [m.id, m.inherited])).toEqual([
      ['rock', 'moon-1'],
      ['ice', 'moon-2'],
      ['planet-1', undefined],
    ]);
    expect(read?.moons?.[1]?.moons?.[0]?.inherited).toBe('moon-2/moon-3');
    expect(read?.moons?.[0]?.overlays).toEqual(['nexus']);
    // A scene with the library given reads them too; one of another planet has none.
    expect(sceneBodies({ bodies: [korhal] }, 'scene-1', [], library)[0]?.moons).toHaveLength(2);
    expect(withLibraryMoons([{ ...korhal, id: 'azeroth' }], library)[0]?.moons).toBeUndefined();
  });

  it('keeps what a scene sets for each by its key, and nothing where it is as the planet has it', () => {
    const read = withLibraryMoons([{ ...korhal, moons: [own] }], library);
    expect(storedBodies(read, library)).toEqual([{ ...korhal, moons: [own] }]);
    let bodies = setOrbit(read, [0, 0], { radius: 3 });
    bodies = changeSettings(bodies, [0, 1], '', (s) => ({ ...s, enabled: false }));
    bodies = setOverlays(bodies, [0, 0], [], '');
    bodies = setOrbit(bodies, [0, 1, 0], { size: 0.5 });
    const stored = storedBodies(bodies, library);
    expect(stored[0]?.moons).toEqual([own]);
    expect(stored[0]?.moonsSet).toEqual({
      'moon-1': { orbit: { radius: 3 }, overlays: [] },
      'moon-2': { settings: { enabled: false } },
      'moon-2/moon-3': { orbit: { size: 0.5 } },
    });
    // Read again, it is as set; reset, as the planet has it.
    const again = withLibraryMoons(stored, library)[0]!;
    expect(again.moons?.[0]).toMatchObject({ orbit: { radius: 3 }, overlays: [] });
    expect(again.moons?.[1]?.settings).toEqual({ enabled: false });
    const reset = storedBodies(
      resetMoon(withLibraryMoons(stored, library), [0, 0], library),
      library,
    );
    expect(reset[0]?.moonsSet).toEqual({
      'moon-2': { settings: { enabled: false } },
      'moon-2/moon-3': { orbit: { size: 0.5 } },
    });
  });

  it('places them about a set’s planets, off where the planet or a body each is a moon of is', () => {
    const view = { eye: [0, -40, 5], forward: [0, 1, 0], up: [0, 0, 1] } as const;
    const set = [
      { id: 'korhal', position: [0, 65, 4] as const, radius: 18 },
      { id: 'azeroth', position: [30, 65, 4] as const, radius: 9, enabled: false },
    ];
    const off: LibraryState = {
      ...EMPTY_LIBRARY,
      moons: { korhal: [rock, { ...ice, settings: { enabled: false } }], azeroth: [rock] },
    };
    const placed = setWithMoons(set, off, view);
    expect(placed.map((p) => p.id)).toEqual(['korhal', 'rock', 'ice', 'dust', 'azeroth', 'rock']);
    expect(placed[1]).toMatchObject({ overlays: ['nexus'] });
    expect(placed[1]?.enabled).toBeUndefined();
    expect(placed[2]?.enabled).toBe(false);
    expect(placed[3]?.enabled).toBe(false); // its parent is off
    expect(placed[5]?.enabled).toBe(false); // its planet is off
    expect(placed[1]?.position).toEqual(
      placeBodies({ position: [0, 65, 4], radius: 18 }, inheritedMoons([rock], undefined), view)[1]
        ?.position,
    );
    expect(libraryMoonsOf(set, off).map((m) => m.id)).toEqual(['rock', 'ice', 'dust', 'rock']);
  });
});
