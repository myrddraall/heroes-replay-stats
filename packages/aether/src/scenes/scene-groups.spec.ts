import { describe, expect, it } from 'vitest';
import {
  type MoonChoices,
  orbitOffset,
  placeBodies,
  type PlanetChoices,
  type SceneBody,
} from './scene-settings';
import { canPutGroup, groupBodies, groupTransform } from './scene-groups';
import { SCENE_CENTRE } from './scene-bodies';
import { placementFrame, pointToWorld, resolveWorld, type SceneNode } from '../space/graph';
import type { Viewpoint } from '../space/space';
import type { Vec3 } from '../space/vectors';

const korhal: SceneBody = { id: 'korhal', position: [0, 65, 4], radius: 18 };

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

/** The game's camera, as the Play scene's file has it: the scene's own. */
const LAYOUT: Viewpoint = {
  eye: [-0.0018, -41.1988, 5.6051],
  forward: [1.9e-5, 0.999687, -0.025004],
  up: [0, 0, 1],
};
const expectNear = (got: ArrayLike<number>, want: ArrayLike<number>, digits = 9) => {
  expect(got.length).toBe(want.length);
  for (let i = 0; i < want.length; i++) expect(got[i]).toBeCloseTo(want[i]!, digits);
};
describe('groups in the scene graph', () => {
  it("puts a group's planets and their moons where the scene's builders put them, number for number", () => {
    const moons: MoonChoices[] = [
      { id: 'moon', orbit: { radius: 2.4, tilt: 12, turn: 30, progress: 0.9, size: 0.27 } },
    ];
    const group: PlanetChoices = {
      group: true,
      bodies: [{ id: 'a', position: [10, 75, -3], radius: 6, moons }],
    };
    const placement = { group: 'group-1', position: [-20, 90, 8] as Vec3, size: 1.5, turn: 35 };
    const [built] = groupBodies([placement], () => group);
    const nodes: SceneNode[] = [
      { id: 'group', kind: 'group', parent: null, local: groupTransform(placement) },
      {
        id: 'a',
        kind: 'planet',
        parent: 'group',
        local: {
          // In a group, relative to its middle.
          position: [
            10 - SCENE_CENTRE.position[0],
            75 - SCENE_CENTRE.position[1],
            -3 - SCENE_CENTRE.position[2],
          ],
          rotation: 'layout',
          scale: 6,
        },
      },
      {
        id: 'moon',
        kind: 'moon',
        parent: 'a',
        local: { position: orbitOffset(moons[0]!.orbit), rotation: 'layout', scale: 0.27 },
      },
    ];
    const world = resolveWorld(nodes, LAYOUT);
    const planet = world.get('a')!;
    expect(planet.position).toEqual(built!.body.position);
    expect(planet.scale).toBe(built!.body.radius);
    // Its turn is its placement frame where it ends up: the group's turn moves it, never turns it.
    expect(Array.from(planet.rotation)).toEqual(
      Array.from(placementFrame(planet.position, LAYOUT)),
    );
    const [, moon] = placeBodies(
      { position: planet.position, radius: planet.scale },
      moons,
      LAYOUT,
    );
    expect(world.get('moon')!.position).toEqual(moon!.position);
    expect(world.get('moon')!.scale).toBe(moon!.radius);
  });

  it('nests groups as the builder does (within rounding)', () => {
    const inner: PlanetChoices = {
      group: true,
      bodies: [{ id: 'b', position: [5, 70, 0], radius: 3 }],
    };
    const outer: PlanetChoices = {
      group: true,
      groups: [{ group: 'inner', position: [8, 60, 2], size: 0.5, turn: -20 }],
    };
    const groups = (id: string) => (id === 'inner' ? inner : outer);
    const [b] = groupBodies([{ group: 'outer', position: [0, 80, 10], size: 2, turn: 45 }], groups);
    // By hand: the inner group's placement within the outer's, then the outer's in the scene.
    const inGroup = (p: Vec3): Vec3 => [
      p[0] - SCENE_CENTRE.position[0],
      p[1] - SCENE_CENTRE.position[1],
      p[2] - SCENE_CENTRE.position[2],
    ];
    const outerT = groupTransform({ group: 'outer', position: [0, 80, 10], size: 2, turn: 45 });
    const innerT = groupTransform({ group: 'inner', position: [8, 60, 2], size: 0.5, turn: -20 });
    const want = pointToWorld(outerT, inGroup(pointToWorld(innerT, inGroup([5, 70, 0]))));
    expectNear(b!.body.position, want);
    expect(b!.body.radius).toBeCloseTo(3, 12);
  });
});
