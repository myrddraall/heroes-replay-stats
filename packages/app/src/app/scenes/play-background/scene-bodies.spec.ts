import { describe, expect, it } from 'vitest';
import { type PlanetChoices, placeBodies, type SceneBody } from './background-scene';
import {
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
  const eye = [-0.0018, -41.1988, 5.6051] as const;
  const set = [
    { id: 'play-large', position: [-48.249, 64.647, 25.444], radius: 27.25 },
    { id: 'play-medium', position: [37.282, 64.892, 14.189], radius: 9.037 },
    { id: 'play-small', position: [27.752, 53.789, 7.471], radius: 1.566 },
  ] as const;

  it('are the game’s, its small one a moon of its medium one where the game puts it', () => {
    const bodies = playScreenBodies(set, eye);
    expect(bodies.map((b) => b.id)).toEqual(['play-large', 'play-medium']);
    expect(bodies[0]).toEqual({ ...set[0] });
    const medium = bodies[1]!;
    expect(medium.moons?.map((m) => m.id)).toEqual(['play-small']);
    const [, small] = placeBodies(medium, medium.moons!, eye);
    small!.position.forEach((v, k) => expect(v).toBeCloseTo(set[2].position[k]!, 4));
    expect(small!.radius).toBeCloseTo(set[2].radius, 6);
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
