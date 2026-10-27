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
