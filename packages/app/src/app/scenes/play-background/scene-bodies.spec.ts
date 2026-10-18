import { describe, expect, it } from 'vitest';
import type { SceneBody } from './background-scene';
import {
  addMoonAt,
  addPlanet,
  bodyAt,
  changeSettings,
  removeAt,
  SCENE_CENTRE,
  sceneBodies,
  setPlace,
  setStyle,
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
