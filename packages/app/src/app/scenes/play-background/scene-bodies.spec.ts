import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ORBIT,
  type MoonChoices,
  type PlanetChoices,
  placeBodies,
  type SceneBody,
} from './background-scene';
import { EMPTY_LIBRARY, type LibraryState } from './background-design';
import {
  inheritedMoons,
  libraryMoonsOf,
  resetMoon,
  setOrbit,
  setWithMoons,
  storedBodies,
  withLibraryMoons,
  withOverlaySwitched,
  addMoonAt,
  addPlanet,
  canPutGroup,
  groupBodies,
  bodyAt,
  changeSettings,
  playScreenBodies,
  removeAt,
  SCENE_CENTRE,
  sceneBodies,
  setPlace,
  setOverlays,
  resetOverlays,
  withLightSwitched,
  withMaterialSwitched,
} from './scene-bodies';

const korhal: SceneBody = { id: 'korhal', position: [0, 65, 4], radius: 18 };

describe('scene bodies', () => {
  it('reads a scene kept with one planet as that planet in the middle of the view', () => {
    expect(sceneBodies({ planet: 'azeroth', style: 'nexus', moons: [] }, 'scene-1')).toEqual([
      { id: 'azeroth', ...SCENE_CENTRE, style: 'nexus', variants: undefined, moons: [] },
    ]);
    // Kept by a planet's id: that planet.
    expect(sceneBodies({ style: 'nexus' }, 'korhal')[0]?.id).toBe('korhal');
    // A new scene names no planet; a preset has its own.
    expect(sceneBodies({}, 'scene-2')).toEqual([]);
    expect(sceneBodies(undefined, 'play-screen', [korhal])).toEqual([korhal]);
    expect(sceneBodies({ bodies: [] }, 'play-screen', [korhal])).toEqual([]);
  });

  it('adds planets beside the first, and moons about any body', () => {
    const one = addPlanet([], 'korhal');
    expect(one.bodies).toEqual([{ id: 'korhal', ...SCENE_CENTRE }]);
    const two = addPlanet(one.bodies, 'azeroth');
    expect(two.path).toEqual([1]);
    expect(two.bodies[1]?.radius).toBeLessThan(SCENE_CENTRE.radius);
    expect(two.bodies[1]?.position[0]).not.toBe(SCENE_CENTRE.position[0]);
    const moon = addMoonAt(two.bodies, [1], 'planet-1');
    expect(moon.path).toEqual([1, 0]);
    const moonOfMoon = addMoonAt(moon.bodies, [1, 0], 'planet-2');
    expect(moonOfMoon.path).toEqual([1, 0, 0]);
    expect(bodyAt(moonOfMoon.bodies, [1, 0, 0])?.id).toBe('planet-2');
  });

  it('sets a planet for what it wears, a moon its own, and moves and removes bodies', () => {
    let bodies = addMoonAt([korhal], [0], 'planet-1').bodies;
    bodies = setOverlays(bodies, [0], ['nexus'], '');
    bodies = changeSettings(bodies, [0], 'nexus', (s) => ({ ...s, lighting: 2 }));
    bodies = changeSettings(bodies, [0, 0], '', (s) => ({ ...s, shade: 0.5 }));
    bodies = setPlace(bodies, [0], { radius: 10 });
    expect(bodies[0]).toMatchObject({
      overlays: ['nexus'],
      radius: 10,
      variants: { nexus: { lighting: 2 } },
    });
    expect(bodyAt(bodies, [0, 0])).toMatchObject({ settings: { shade: 0.5 } });
    expect(removeAt(bodies, [0, 0])[0]?.moons).toBeUndefined();
    expect(removeAt(bodies, [0])).toEqual([]);
  });
});

describe('the Play screen’s planets', () => {
  const view = { eye: [-0.0018, -41.1988, 5.6051], forward: [0, 0.9997, -0.025], up: [0, 0, 1] } as const;
  const set = [
    { id: 'play-large', position: [-48.249, 64.647, 25.444], radius: 27.25 },
    { id: 'play-medium', position: [37.282, 64.892, 14.189], radius: 9.037 },
    { id: 'play-small', position: [27.752, 53.789, 7.471], radius: 1.566 },
  ] as const;

  it('are the game’s, its small one a moon of its medium one where the game puts it', () => {
    const bodies = playScreenBodies(set, view);
    expect(bodies.map((b) => b.id)).toEqual(['play-large', 'play-medium']);
    expect(bodies[0]).toEqual({ ...set[0] });
    const medium = bodies[1]!;
    expect(medium.moons?.map((m) => m.id)).toEqual(['play-small']);
    const [, small] = placeBodies(medium, medium.moons!, view);
    small!.position.forEach((v, k) => expect(v).toBeCloseTo(set[2].position[k]!, 4));
    expect(small!.radius).toBeCloseTo(set[2].radius, 6);
  });

  it('keep the small one where the game puts it, seen from anywhere: behind the medium one from its far side', () => {
    const medium = playScreenBodies(set, view)[1]!;
    const [, small] = placeBodies(medium, medium.moons!, view);
    // Looked at from beyond the medium one (as the editor's camera may), the small one is where
    // it was, so further off than the medium one: drawn behind it.
    const far = [37.282, 140, 14.189] as const;
    const from = (p: readonly number[]) => Math.hypot(...p.map((v, k) => v - far[k]!));
    small!.position.forEach((v, k) => expect(v).toBeCloseTo(set[2].position[k]!, 4));
    expect(from(small!.position)).toBeGreaterThan(from(medium.position));
  });
});

describe('switching a light or a material on or off', () => {
  it('sets it only where it differs from the levels under it', () => {
    // On under it: switched off is set here; back on is nothing set.
    const off = withLightSwitched({}, 'ambient', false, true)!;
    expect(off).toEqual({ lights: { ambient: { enabled: false } } });
    expect(withLightSwitched(off, 'ambient', true, true)).toBeUndefined();
    // Off under it (switched off in the library): switched on is set; what else is set is kept.
    const set = { lights: { shadow: { strength: 2 } } };
    expect(withLightSwitched(set, 'shadow', true, false)).toEqual({
      lights: { shadow: { strength: 2, enabled: true } },
    });
    expect(
      withLightSwitched(
        { lights: { shadow: { strength: 2, enabled: true } } },
        'shadow',
        false,
        false,
      ),
    ).toEqual(set);
  });

  it('switches a light added at the level edited itself, on as it starts', () => {
    const lamp = { id: 'added-lamp', kind: 'ambient', name: 'Lamp' } as const;
    const off = withLightSwitched({ added: [lamp] }, lamp.id, false, true)!;
    expect(off.added).toEqual([{ ...lamp, enabled: false }]);
    expect(withLightSwitched(off, lamp.id, true, true)!.added).toEqual([lamp]);
  });

  it('switches a material the same way', () => {
    const off = withMaterialSwitched({}, 'haze', false, true)!;
    expect(off).toEqual({ materials: { haze: { enabled: false } } });
    expect(withMaterialSwitched(off, 'haze', true, true)).toBeUndefined();
    expect(withMaterialSwitched({}, 'haze', true, false)).toEqual({
      materials: { haze: { enabled: true } },
    });
  });
});

describe('the overlays a body wears', () => {
  const korhal = { id: 'korhal', position: [0, 0, 0], radius: 1 } as const;

  it('keeps what was set on a planet when another overlay is put on, and takes the old style off', () => {
    let bodies: readonly SceneBody[] = [
      { ...korhal, style: 'nexus', variants: { nexus: { lighting: 2 } } },
    ];
    bodies = setOverlays(bodies, [0], ['nexus', 'clouds'], 'nexus');
    expect(bodies[0]).toEqual({
      ...korhal,
      overlays: ['nexus', 'clouds'],
      variants: { nexus: { lighting: 2 }, 'nexus+clouds': { lighting: 2 } },
    });
    // What it wears back as its own: its settings for that kept too, nothing chosen.
    bodies = resetOverlays(bodies, [0], 'nexus+clouds', []);
    expect(bodies[0]?.overlays).toBeUndefined();
    expect(bodies[0]?.variants?.['']).toEqual({ lighting: 2 });
  });

  it('switches an overlay on or off at the level edited, nothing set where that is as under it', () => {
    expect(withOverlaySwitched({}, 'nexus', false, true)).toEqual({
      overlaysEnabled: { nexus: false },
    });
    expect(
      withOverlaySwitched({ overlaysEnabled: { nexus: false } }, 'nexus', true, true),
    ).toBeUndefined();
  });
});

describe('groups', () => {
  const lamp = { id: 'added-1', kind: 'ambient', name: 'Lamp' } as const;
  const groups: Record<string, PlanetChoices> = {
    'group-1': {
      group: true,
      bodies: [korhal, { ...korhal, id: 'sanctuary', position: [20, 65, 4], radius: 6 }],
      lights: [lamp],
    },
    'group-2': {
      group: true,
      bodies: [{ ...korhal, id: 'azeroth' }],
      groups: [{ group: 'group-1', position: [0, 65, 4], size: 0.5 }],
    },
  };
  const find = (id: string) => groups[id];

  it("puts a group's planets where it is placed: about its middle, sized, its lights theirs", () => {
    const bodies = groupBodies([{ group: 'group-1', position: [10, 80, 0], size: 2 }], find);
    expect(bodies.map((b) => b.body.id)).toEqual(['korhal', 'sanctuary']);
    // Its middle (where a scene's first planet goes) where it is put.
    expect(bodies[0]!.body.position).toEqual([10, 80, 0]);
    expect(bodies[0]!.body.radius).toBe(36);
    // 20 to the right of its middle, twice as far.
    expect(bodies[1]!.body.position).toEqual([50, 80, 0]);
    expect(bodies[1]!.lights).toEqual([lamp]);
  });

  it('turns a group about the up through its middle', () => {
    const [, turned] = groupBodies([{ group: 'group-1', position: [0, 65, 4], turn: 90 }], find);
    expect(turned!.body.position[0]).toBeCloseTo(0);
    expect(turned!.body.position[1]).toBeCloseTo(45);
  });

  it('puts the groups in a group in too, and leaves out those switched off', () => {
    const bodies = groupBodies([{ group: 'group-2', position: [0, 65, 4] }], find);
    expect(bodies.map((b) => [b.body.id, b.placement])).toEqual([
      ['azeroth', [0]],
      ['korhal', [0, 0]],
      ['sanctuary', [0, 0]],
    ]);
    expect(groupBodies([{ group: 'group-2', position: [0, 65, 4], enabled: false }], find)).toEqual(
      [],
    );
  });

  it('keeps a group from being put in itself, or round about', () => {
    expect(canPutGroup('group-1', 'group-2', find)).toBe(true);
    expect(canPutGroup('group-2', 'group-1', find)).toBe(false);
    expect(canPutGroup('group-1', 'group-1', find)).toBe(false);
    // Put in itself anyway (an old design): it stops where it would go round again.
    const self = (id: string) =>
      id === 'group-3'
        ? { bodies: [korhal], groups: [{ group: 'group-3', position: [0, 65, 4] as const }] }
        : undefined;
    expect(groupBodies([{ group: 'group-3', position: [0, 65, 4] }], self)).toHaveLength(1);
  });
});

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
