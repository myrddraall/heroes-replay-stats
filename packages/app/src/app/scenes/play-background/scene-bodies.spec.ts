import { describe, expect, it } from 'vitest';
import { placeBodies, type SceneBody } from './background-scene';
import {
  addMoonAt,
  addPlanet,
  bodyAt,
  changeSettings,
  playScreenBodies,
  removeAt,
  SCENE_CENTRE,
  sceneBodies,
  setPlace,
  setStyle,
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

  it('sets a planet in the style it wears, a moon its own, and moves and removes bodies', () => {
    let bodies = addMoonAt([korhal], [0], 'planet-1').bodies;
    bodies = setStyle(bodies, [0], 'nexus');
    bodies = changeSettings(bodies, [0], 'nexus', (s) => ({ ...s, lighting: 2 }));
    bodies = changeSettings(bodies, [0, 0], '', (s) => ({ ...s, shade: 0.5 }));
    bodies = setPlace(bodies, [0], { radius: 10 });
    expect(bodies[0]).toMatchObject({
      style: 'nexus',
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
    // Off under it (a grid's activation light): switched on is set; what else is set is kept.
    const set = { lights: { activation: { strength: 2 } } };
    expect(withLightSwitched(set, 'activation', true, false)).toEqual({
      lights: { activation: { strength: 2, enabled: true } },
    });
    expect(
      withLightSwitched(
        { lights: { activation: { strength: 2, enabled: true } } },
        'activation',
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
