import {
  type AddedPart,
  addedSourced,
  addedWithUnused,
  type CreatedOverlay,
  type CreatedShape,
  type MaterialSource,
  nextPartId,
  type OverlayKind,
} from '@myrddraall/heroes-replay-stats-aether/overlays';
import { without } from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { PartSettingsMap } from '@myrddraall/heroes-replay-stats-aether/formats';
import {
  materialKey,
  type MaterialSettings,
  type MaterialSettingsMap,
} from '@myrddraall/heroes-replay-stats-aether/materials';

/**
 * Where parts made in the editor are kept at the level edited, as an editor changes them: an
 * overlay made in the editor's, or those added straight onto a body or a sky (its own). Either way
 * they are changed as a list of parts each with where its materials are (`AddedPart`).
 */
export interface PartHost {
  /** What they are about: a planet (spheres, rings, a planet's parts reused) or the sky (bands, its overlays' parts). */
  readonly kind: OverlayKind;
  readonly parts: readonly AddedPart[];
  /** The ids its owner's other parts have (its data's, those under this level), not to be given again. */
  readonly taken: readonly string[];
  /** The parts kept as they are to be. */
  set(parts: readonly AddedPart[]): void;
}

/** A part reused from the game data, as offered: what it is added as. */
export interface ReusablePart {
  /** What it is called where it is offered (its name, and whose it is). */
  readonly label: string;
  /** The id it is added under, numbered (`shell-1`). */
  readonly base: string;
  readonly part: Omit<AddedPart, 'id'>;
}

/** An overlay made in the editor's parts as a host's (each with where its materials are). */
export const overlayParts = (o: CreatedOverlay): AddedPart[] =>
  o.parts.map((p) => ({
    ...p,
    sources: Object.fromEntries(
      p.materials.flatMap((m) => (o.sources[m] ? [[m, o.sources[m]]] : [])),
    ),
  }));

/** An overlay made in the editor with a host's parts (where their materials are kept together). */
export function withOverlayParts(o: CreatedOverlay, parts: readonly AddedPart[]): CreatedOverlay {
  return {
    ...o,
    parts: parts.map((p) => without(p, ['sources']) ?? p),
    sources: addedSourced(parts).sources,
  };
}

const ids = (host: PartHost) => [...host.taken, ...host.parts.map((p) => p.id)];

/** A new part of a shape added (drawing nothing yet): its id. */
export function addShape(host: PartHost, shape: CreatedShape): string {
  const id = nextPartId(ids(host), shape);
  host.set([...host.parts, { id, shape, materials: [], sources: {} }]);
  return id;
}

/** A part of the game data's added, reused (its materials with it): its id. */
export function addReused(host: PartHost, reused: ReusablePart): string {
  const id = nextPartId(ids(host), reused.base);
  host.set([...host.parts, { id, ...reused.part }]);
  return id;
}

/** A part taken out (what only it drew, with it). */
export function removePart(host: PartHost, id: string): void {
  host.set(host.parts.filter((p) => p.id !== id));
}

/** A material drawn on a part too, over the rest, kept by where it is (`source`). */
export function addMaterial(
  host: PartHost,
  id: string,
  name: string,
  source: MaterialSource,
): void {
  host.set(
    host.parts.map((p) =>
      p.id === id && !p.materials.includes(name)
        ? {
            ...p,
            materials: [...p.materials, name],
            sources: { ...p.sources, [name]: p.sources[name] ?? source },
          }
        : p,
    ),
  );
}

/** A material no longer drawn on a part. */
export function removeMaterial(host: PartHost, id: string, name: string): void {
  host.set(
    host.parts.map((p) =>
      p.id === id ? addedWithUnused({ ...p, materials: p.materials.filter((m) => m !== name) }) : p,
    ),
  );
}

/**
 * Settings (a body's, a sky's) with parts added there moved onto an overlay made of them: what was
 * set for each part kept as the overlay's (`own:<id>` as `style:<overlay>:<id>`), what was set for
 * the materials they draw kept for the overlay's too (by `materialKey`; by name still, as the
 * owner's own may draw one), and the parts no longer added there.
 */
export function settingsAsOverlay<
  T extends {
    readonly parts?: PartSettingsMap;
    readonly materials?: MaterialSettingsMap;
    readonly order?: readonly string[];
    readonly addedParts?: readonly AddedPart[];
  },
>(s: T, overlay: string, moved: readonly AddedPart[]): T {
  const ids = new Set(moved.map((p) => p.id));
  const names = new Set(moved.flatMap((p) => p.materials));
  const parts = Object.fromEntries(
    Object.entries(s.parts ?? {}).map(([k, v]) =>
      k.startsWith('own:') && ids.has(k.slice(4)) ? [`style:${overlay}:${k.slice(4)}`, v] : [k, v],
    ),
  ) as PartSettingsMap;
  const materials: Record<string, MaterialSettings> = { ...s.materials };
  for (const n of names) if (s.materials?.[n]) materials[materialKey(n, overlay)] = s.materials[n];
  const order = s.order?.flatMap((k) => (names.has(k) ? [k, materialKey(k, overlay)] : [k]));
  const rest = without(s, ['addedParts', 'parts', 'materials', 'order']) ?? ({} as T);
  return {
    ...rest,
    ...(Object.keys(parts).length ? { parts } : {}),
    ...(Object.keys(materials).length ? { materials } : {}),
    ...(order ? { order } : {}),
  };
}
