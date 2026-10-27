import { describe, expect, it } from 'vitest';
import { placeBodies, type SceneBody } from './scene-settings';
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
} from './scene-bodies';
import { setOverlays } from './body-overlays';

const korhal: SceneBody = { id: 'korhal', position: [0, 65, 4], radius: 18 };

describe('scene bodies', () => {
  it('reads a scene kept with one planet as that planet in the middle of the view', () => {
    expect(sceneBodies({ planet: 'azeroth', style: 'nexus', moons: [] }, 'scene-1')).toEqual([
      {
        id: 'azeroth',
        key: 'body-1',
        ...SCENE_CENTRE,
        style: 'nexus',
        variants: undefined,
        moons: [],
      },
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
    expect(one.bodies).toEqual([{ id: 'korhal', key: one.path[0], ...SCENE_CENTRE }]);
    const two = addPlanet(one.bodies, 'azeroth');
    // Each its own key, never one taken before: found by it wherever it is.
    expect(two.path).toEqual([two.bodies[1]!.key]);
    expect(two.path[0]).toMatch(/^body-/);
    expect(two.path[0]).not.toBe(one.path[0]);
    expect(two.bodies[1]?.radius).toBeLessThan(SCENE_CENTRE.radius);
    expect(two.bodies[1]?.position[0]).not.toBe(SCENE_CENTRE.position[0]);
    const moon = addMoonAt(two.bodies, two.path, 'planet-1');
    expect(moon.path.slice(0, 1)).toEqual(two.path);
    const moonOfMoon = addMoonAt(moon.bodies, moon.path, 'planet-2');
    expect(moonOfMoon.path).toHaveLength(3);
    expect(bodyAt(moonOfMoon.bodies, moonOfMoon.path)?.id).toBe('planet-2');
    expect(bodyAt([...moonOfMoon.bodies].reverse(), moonOfMoon.path)?.id).toBe('planet-2');
  });

  it('sets a planet whatever it wears, a moon its own, and moves and removes bodies', () => {
    const added = addMoonAt([korhal], ['0'], 'planet-1');
    let bodies = added.bodies;
    bodies = setOverlays(bodies, ['0'], ['nexus'], '');
    bodies = changeSettings(bodies, ['0'], 'nexus', (s) => ({ ...s, lighting: 2 }));
    bodies = changeSettings(bodies, added.path, '', (s) => ({ ...s, shade: 0.5 }));
    bodies = setPlace(bodies, ['0'], { radius: 10 });
    expect(bodies[0]).toMatchObject({
      overlays: ['nexus'],
      radius: 10,
      settings: { lighting: 2 },
    });
    expect(bodyAt(bodies, added.path)).toMatchObject({ settings: { shade: 0.5 } });
    expect(removeAt(bodies, added.path)[0]?.moons).toBeUndefined();
    expect(removeAt(bodies, ['0'])).toEqual([]);
  });
});

describe('the Play screen’s planets', () => {
  const view = {
    eye: [-0.0018, -41.1988, 5.6051],
    forward: [0, 0.9997, -0.025],
    up: [0, 0, 1],
  } as const;
  const set = [
    { id: 'play-large', position: [-48.249, 64.647, 25.444], radius: 27.25 },
    { id: 'play-medium', position: [37.282, 64.892, 14.189], radius: 9.037 },
    { id: 'play-small', position: [27.752, 53.789, 7.471], radius: 1.566 },
  ] as const;

  it('are the game’s, its small one a moon of its medium one where the game puts it', () => {
    const bodies = playScreenBodies(set, view);
    expect(bodies.map((b) => b.id)).toEqual(['play-large', 'play-medium']);
    expect(bodies[0]).toEqual({ ...set[0], key: 'body-play-large' });
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
