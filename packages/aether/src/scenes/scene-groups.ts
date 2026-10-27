import type { GroupPlacement, PlanetChoices, SceneBody } from './scene-settings';
import { compose, pointToWorld, type Transform } from '../space/graph';
import type { AddedLight } from '../lights/lights';
import type { Vec3 } from '../space/vectors';
import { SCENE_CENTRE } from './scene-bodies';

/** What the ids of groups start with (`group-<n>`): kept with the scenes, they are none. */
export const GROUP_PREFIX = 'group-';

/** Whether a scene's id is a group's. */
export const isGroup = (id: string) => id.startsWith(GROUP_PREFIX);

/** How deep groups are put in groups before the deeper are left out (one put in itself, or round about). */
const GROUP_DEPTH = 6;

/** A group's planet as put in a scene: which placement it comes from (by index, outermost first), and what it is there. */
export interface GroupBody {
  readonly placement: readonly number[];
  /** Its index among its group's own planets. */
  readonly index: number;
  /** The group it is a planet of (its settings are kept there). */
  readonly group: string;
  readonly body: SceneBody;
  /** The lights of the groups it is in (they light their own planets alone). */
  readonly lights: readonly AddedLight[];
}

/**
 * A group's transform in what it is put in: its middle (`SCENE_CENTRE` in its own space) put at the
 * placement's position, turned about the up through it (to the right seen from the eye), sized.
 * What is in a group is placed relative to its middle (`inGroup`).
 */
export function groupTransform(placement: GroupPlacement): Transform {
  const a = ((placement.turn ?? 0) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return {
    position: placement.position,
    rotation: [c, -s, 0, s, c, 0, 0, 0, 1],
    scale: placement.size ?? 1,
  };
}

/** A place in a group's own space, relative to its middle (the local position its group's transform takes). */
const inGroup = (p: Vec3): Vec3 => {
  const centre = SCENE_CENTRE.position;
  return [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]];
};

/**
 * The planets of the groups put in a scene (or a group), where they are put: each group's own, and
 * those of the groups put in it, in turn; those switched off left out. `groups` finds a group by
 * its id. One put in itself (or round about) stops where it would go round again. Each group
 * hangs from what it is put in (`parent`: the world transform of the group it is in; none: the scene), each planet from its group; a
 * group's turn moves where its planets are, not the way they face (each faces as its placement
 * frame has it, wherever it ends up).
 */
export function groupBodies(
  placements: readonly GroupPlacement[] | undefined,
  groups: (id: string) => PlanetChoices | undefined,
  within: readonly string[] = [],
  parent?: Transform,
): GroupBody[] {
  if (within.length >= GROUP_DEPTH) return [];
  return (placements ?? []).flatMap((placement, i) => {
    const group = groups(placement.group);
    if (!group || placement.enabled === false || within.includes(placement.group)) return [];
    const lights = group.lights ?? [];
    // Put in the scene, its transform is its world one (the scene's places are the world's); put
    // in a group, its place is relative to that group's middle.
    const local = groupTransform(placement);
    const world = parent ? compose(parent, { ...local, position: inGroup(local.position) }) : local;
    const own = (group.bodies ?? []).map((body, index): GroupBody => ({
      placement: [i],
      index,
      group: placement.group,
      body: {
        ...body,
        position: pointToWorld(world, inGroup(body.position)),
        radius: body.radius * world.scale,
      },
      lights,
    }));
    const inner = groupBodies(group.groups, groups, [...within, placement.group], world).map(
      (g): GroupBody => ({
        ...g,
        placement: [i, ...g.placement],
        lights: [...g.lights, ...lights],
      }),
    );
    return [...own, ...inner];
  });
}

/** Whether a group may be put in another (`into`): not itself, nor one it is in, round about. */
export function canPutGroup(
  group: string,
  into: string,
  groups: (id: string) => PlanetChoices | undefined,
): boolean {
  if (group === into) return false;
  const holds = (id: string, seen: readonly string[]): boolean =>
    !seen.includes(id) &&
    (groups(id)?.groups ?? []).some((p) => p.group === into || holds(p.group, [...seen, id]));
  return !holds(group, []);
}
