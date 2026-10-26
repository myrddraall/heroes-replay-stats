import type { SceneBlend, SceneMaterial } from './play-scene';
import type { BodyPart, PlanetFile } from './planet-files';

/** How a planet (its file) wears a style (by its id; none: none). */
export const wearOf = (planet: PlanetFile | undefined, style: string | undefined) =>
  style ? planet?.tuning?.variants?.[style] : undefined;

/** A style's parts as a planet wears them (its own shapes and mappings for them, where it has any). */
export function wornParts(
  planet: PlanetFile | undefined,
  style: string | undefined,
  parts: readonly BodyPart[],
): readonly BodyPart[] {
  const own = wearOf(planet, style)?.parts;
  return own ? parts.map((p) => (own[p.role] ? { ...p, ...own[p.role] } : p)) : parts;
}

/** A material with its alpha masks reading other textures (`masks`, in order), where given. */
export function withMasks(
  material: SceneMaterial,
  masks: readonly string[] | undefined,
): SceneMaterial {
  if (!masks?.length) return material;
  return {
    ...material,
    alphaMasks: material.alphaMasks.map((m, i) => (masks[i] ? { ...m, texture: masks[i] } : m)),
  };
}

/** A material as its draw order needs it: its name, how it blends, its priority in the data. */
export interface Ordered {
  readonly name: string;
  readonly blend: SceneBlend;
  readonly priority?: number;
}

/**
 * Materials' names in the order they are drawn (the later over the earlier): the opaque ones first,
 * by priority (a surface under what glows over it); then the rest as `order` lists them
 * where it is given (those it leaves out after, in their own order), else by their priority,
 * highest first, ties as the data lists them.
 */
export function drawOrder(materials: readonly Ordered[], order?: readonly string[]): string[] {
  const byPriority = (a: { m: Ordered; i: number }, b: { m: Ordered; i: number }) =>
    (b.m.priority ?? 0) - (a.m.priority ?? 0) || a.i - b.i;
  const byData = materials.map((m, i) => ({ m, i }));
  const opaque = byData.filter(({ m }) => m.blend === 'opaque').sort(byPriority);
  const rest = byData.filter(({ m }) => m.blend !== 'opaque').sort(byPriority);
  const rank = (name: string, fallback: number) => {
    const at = order?.indexOf(name) ?? -1;
    return at >= 0 ? at : (order?.length ?? 0) + fallback;
  };
  const ordered = order
    ? rest.map((x, i) => ({ ...x, r: rank(x.m.name, i) })).sort((a, b) => a.r - b.r)
    : rest;
  return [...new Set([...opaque, ...ordered].map(({ m }) => m.name))];
}

/**
 * A draw order with `name` moved to just before (or after) `target`. Moved within its group
 * (`group`: the names shown with it), it takes one of its group's places, the rest of the order as
 * it is; moved from another group, it goes beside `target` in the whole order.
 */
export function reordered(
  order: readonly string[],
  group: readonly string[],
  name: string,
  target: string,
  after: boolean,
): string[] {
  if (name === target) return [...order];
  const place = (list: string[]) => {
    const at = list.indexOf(target);
    if (at < 0) return [...list, name];
    list.splice(at + (after ? 1 : 0), 0, name);
    return list;
  };
  if (!group.includes(name) || !group.includes(target))
    return place(order.filter((n) => n !== name));
  const inGroup = order.filter((n) => group.includes(n));
  const moved = place(inGroup.filter((n) => n !== name));
  let next = 0;
  return order.map((n) => (group.includes(n) ? moved[next++]! : n));
}
