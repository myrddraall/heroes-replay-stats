import {
  type AddedLight,
  type BodyLight,
  downOf,
  knownLights,
  type LightId,
  outOf,
  type LightSettings,
  type LightSettingsMap,
} from './lights';

/**
 * Where a body is in a scene's tree, for the lights that reach it from elsewhere: its key, the
 * body it is a moon of (none: a planet), and the group it is in (none: the scene's own).
 */
export interface LightBranch {
  readonly key: string;
  readonly parent?: string;
  readonly group?: string;
}

/** A light reaching a body from another (`from`, its key). */
export interface FlowedLight {
  readonly light: AddedLight;
  readonly from: string;
}

/** The id a body's data light is handed on under: its owner's (the body's library id) and its own. */
export const handedOnId = (owner: string, id: string): `added-${string}` => `added-~${owner}~${id}`;

/** The id a light handed on has on its own body (its data's: see `handedOnId`; one added: its own). */
export const sourceIdOf = (id: LightId): LightId =>
  id.startsWith('added-~') ? (id.slice(id.lastIndexOf('~') + 1) as LightId) : id;

/** A light as another body takes it: all of that body lit, and handed on no further. */
export const receivedLight = (light: AddedLight): AddedLight => ({
  ...light,
  reach: undefined,
  down: undefined,
  out: undefined,
  moons: undefined,
});

/** A body in the tree, and its lights as set at it (on or off: those off reach nothing). */
export interface FlowNode {
  readonly branch: LightBranch;
  readonly lights: readonly AddedLight[];
}

/**
 * The lights each body is lit by from elsewhere in the tree (its own not among them), by its key:
 * each light reaches what is under its body where it lights down (`downOf`: its moons, theirs
 * too), and the whole of what `out` names (the planet its body is a moon of with all of that
 * planet's moons, the group its body is in, the scene), less its own body's moons where it
 * doesn't light down. What a light reaches of its own body (`reach`) is its own body's: a light
 * reaching another reaches all of it, as a scene's does. Each is as `moved` puts it from its body
 * to the one it reaches (where it is, by each body's frame: none, as it is).
 */
export function flowLights(
  nodes: readonly FlowNode[],
  moved: (light: AddedLight, from: string, to: string) => AddedLight = (light) => light,
): Map<string, FlowedLight[]> {
  const byKey = new Map(nodes.map((n) => [n.branch.key, n] as const));
  const children = new Map<string, string[]>();
  for (const n of nodes)
    if (n.branch.parent !== undefined)
      children.set(n.branch.parent, [...(children.get(n.branch.parent) ?? []), n.branch.key]);
  const under = (key: string): string[] =>
    (children.get(key) ?? []).flatMap((c) => [c, ...under(c)]);
  const top = (key: string): string => {
    const parent = byKey.get(key)?.branch.parent;
    return parent !== undefined && byKey.has(parent) ? top(parent) : key;
  };
  const out = new Map<string, FlowedLight[]>();
  const give = (key: string, flowed: FlowedLight) =>
    out.set(key, [...(out.get(key) ?? []), flowed]);
  for (const n of nodes) {
    const key = n.branch.key;
    for (const light of n.lights) {
      if (light.enabled === false) continue;
      const down = downOf(light);
      const reach = outOf(light);
      if (!down && !reach) continue;
      const mine = new Set(under(key));
      const reached = new Set(down ? mine : []);
      if (reach) {
        const wide =
          reach === 'scene'
            ? nodes.map((m) => m.branch.key)
            : reach === 'group'
              ? n.branch.group === undefined
                ? []
                : nodes.filter((m) => m.branch.group === n.branch.group).map((m) => m.branch.key)
              : [top(key), ...under(top(key))];
        for (const k of wide) if (down || !mine.has(k)) reached.add(k);
      }
      reached.delete(key);
      const given = receivedLight(light);
      for (const k of reached) give(k, { light: moved(given, key, k), from: key });
    }
  }
  return out;
}

/**
 * A body's lights as they flow out of it (see `flowLights`): those added to it (its own, its
 * overlays', as set over their own settings), and those of its data (as they light it: `rig`,
 * resolved) that are set to reach beyond it, each as a light added under an id of its own
 * (`owner`'s: the body's library id, so a body lit by it can leave it out by that id wherever it
 * is).
 */
export function lightsOut(
  owner: string,
  rig: readonly BodyLight[],
  added: readonly AddedLight[],
  settings: LightSettingsMap | undefined,
): AddedLight[] {
  const flows = (s: LightSettings | undefined) => !!s && (downOf(s) || !!outOf(s));
  return [
    ...rig
      .filter((l) => flows(settings?.[l.id]))
      .map((l): AddedLight => ({
        ...l,
        id: handedOnId(owner, l.id),
        down: settings?.[l.id]?.down,
        out: settings?.[l.id]?.out,
      })),
    ...knownLights(added)
      .map((l) => ({ ...l, ...settings?.[l.id] }))
      .filter(flows),
  ];
}
