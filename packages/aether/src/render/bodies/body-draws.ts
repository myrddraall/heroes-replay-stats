import type { SceneBlend, SceneMaterial } from '../../formats/play-scene';
import { drawOrder } from '../../formats/wear';
import { IDENTITY, type Mat3 } from '../../space/graph';
import type { MeshDraw, Placed } from '../draw-types';

/** A placed body's draws: which are shown, their order, their turn. */

/** A number for each sky overlay's file, to tell a changed one (one made in the editor) apart. */
const fileIds = new WeakMap<object, number>();

let nextFileId = 0;

export const fileId = (file: object) => {
  let id = fileIds.get(file);
  if (id === undefined) fileIds.set(file, (id = nextFileId++));
  return id;
};

export const moves = (m: SceneMaterial) =>
  [m.diffuse, m.emissive, m.specular, ...m.alphaMasks].some((layer) => layer?.scroll);

export function shown(draw: MeshDraw): boolean {
  const body = draw.placed?.body;
  return !body || (!body.hidden && draw.bodyDraw?.partShown !== false);
}

/** The body's own turn as a draw of it takes it (a halo left square to the camera: none). */
export const turnFor = (s: { readonly turned?: boolean }, bodyTurned: Mat3): Mat3 =>
  s.turned ? bodyTurned : IDENTITY;

export function sorted<T extends { readonly draw: MeshDraw; readonly blend: SceneBlend }>(
  draws: readonly T[],
  orderOf: (placed: Placed | undefined) => readonly string[] | undefined,
): T[] {
  const owners = new Map<Placed | undefined, T[]>();
  for (const d of draws) owners.set(d.draw.placed, [...(owners.get(d.draw.placed) ?? []), d]);
  const rank = new Map<T, number>();
  for (const [placed, list] of owners) {
    const names = drawOrder(
      list.map((d) => ({ name: d.draw.key, blend: d.blend, priority: d.draw.material.priority })),
      orderOf(placed),
    );
    for (const d of list) rank.set(d, names.indexOf(d.draw.key));
  }
  return [...draws].sort(
    (a, b) =>
      Number(a.blend !== 'opaque') - Number(b.blend !== 'opaque') || rank.get(a)! - rank.get(b)!,
  );
}

/**
 * A body's draws, in their order, less each opaque one wholly under a later opaque one on the same
 * part: nothing of it would show. The later covers all of the part where it is switched on, cuts
 * no holes (no cutout, no pattern on its part) and is drawn after it. Switching the later off, or
 * swapping their order (in a variant, a scene), draws the earlier again.
 */
export function withoutHidden<
  T extends {
    readonly draw: MeshDraw;
    readonly blend: SceneBlend;
    readonly enabled: boolean;
    readonly material: SceneMaterial;
  },
>(states: readonly T[]): T[] {
  const covered = new Set<string>();
  const out: T[] = [];
  for (let i = states.length - 1; i >= 0; i--) {
    const s = states[i]!;
    const part = s.draw.partKey;
    if (s.blend === 'opaque' && part !== undefined) {
      if (covered.has(part)) continue;
      if (s.enabled && !(s.material.cutout ?? 0) && !s.draw.part?.pattern) covered.add(part);
    }
    out.push(s);
  }
  return out.reverse();
}
