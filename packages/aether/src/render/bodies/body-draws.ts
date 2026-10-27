import { type SceneBlend, type SceneMaterial } from '../../formats/play-scene';
import { overlayOfFile } from '../../overlays/overlays';
import { type BodyPart, poleOf } from '../../formats/planet-files';
import { drawOrder, wearOf, wornParts } from '../../formats/wear';
import type { LoadedPlanet } from '../../formats/planet-loader';
import { ownPartKey, overlayPartKey } from '../../formats/part-keys';
import { withPart } from '../../formats/part-shapes';
import { type PlanetPlacement } from '../../space/space';
import { bodyTurn, IDENTITY, type Mat3 } from '../../space/graph';
import type { MeshDraw, Placed } from '../draw-types';

/** A placed body's draws: its parts (its overlays' among them), their order, their turn. */

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
  const placement = draw.placed?.placement;
  if (!placement) return true;
  return !placement.hidden && !(draw.partKey && placement.parts?.[draw.partKey]?.enabled === false);
}

export const overlaysOf = (placement: PlanetPlacement) => placement.overlays ?? [];

/** Whether two placements wear the same overlays, in the same order. */
export const sameOverlays = (a: PlanetPlacement, b: PlanetPlacement) =>
  overlaysOf(a).length === overlaysOf(b).length &&
  overlaysOf(a).every((o, i) => o === overlaysOf(b)[i]);

export const wearsIn = (placement: PlanetPlacement) =>
  overlaysOf(placement).map((o) => wearOf(placement.planet.planet, overlayOfFile(o.id)));

export const overlayParts = (
  placement: PlanetPlacement,
  overlay: LoadedPlanet,
): readonly BodyPart[] =>
  wornParts(placement.planet.planet, overlayOfFile(overlay.id), overlay.planet.parts);

/** A placement's parts as set (`part`), each with the part it is of (`source`, as its draws have it). */
export function partsOf(
  placement: PlanetPlacement,
): readonly { readonly source: BodyPart; readonly part: BodyPart }[] {
  return [
    ...placement.planet.planet.parts.map((p) => ({
      source: p,
      part: withPart(p, placement.parts?.[ownPartKey(p)]),
    })),
    ...overlaysOf(placement).flatMap((o) =>
      overlayParts(placement, o).map((p) => ({
        source: p,
        part: withPart(p, placement.parts?.[overlayPartKey(overlayOfFile(o.id), p)]),
      })),
    ),
  ];
}

/** A placement's own turn (`bodyTurn`): its base turn, then about its Axis by its Turn; each its own, else its tuning's. */
export function bodyTurnOf(placement: PlanetPlacement): Mat3 {
  const { planet } = placement.planet;
  return bodyTurn(
    poleOf(planet.parts),
    placement.axis ?? planet.tuning?.axis,
    placement.turn ?? planet.tuning?.turn,
    placement.baseTurn ?? planet.tuning?.baseTurn,
  );
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
