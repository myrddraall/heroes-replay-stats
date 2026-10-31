import type { MoonChoices, PlanetChoices, SceneBody, SkyChoices } from '../scenes/scene-settings';
import { migrateTints } from '../tints/tint-layers';
import { keptColourTint } from '../tints/grading';
import { PREVIEW_SCENE } from '../scenes/scenes';
import type { Design } from '../design/design';
import type { LibraryState } from '../library/library';
import type { CreatedOverlay } from './created-overlays';
import { materialKey, type MaterialSettingsMap } from '../materials/material-settings';

import type { AddedLight, LightReach, LightSettingsMap, Receiver } from '../lights/lights';
import type { PartSettingsMap } from '../formats/part-shapes';
import type { BodySettings } from '../bodies/body-settings';
import { keyedScene } from '../scenes/scene-keys';

/**
 * Overlays: what a body (or the sky) wears over its own, several at once, the later over the
 * earlier. An overlay is the game data's (a style's file, `style-<id>`), or one made in the
 * editor (its id starting `@overlay-`, kept in the design's library and built there).
 */

/** The overlay the design's settings meant before bodies wore several: the only one there was. */
export const LEGACY_OVERLAY = 'nexus';
/** The key a body's settings are kept by for what it wears: the overlays' ids joined ('' for none). */
export const wornKey = (overlays: readonly string[]) => overlays.join('+');

/** What a body chose to wear (one kept before bodies wore several read as the list of it); none: its own. */
export function chosenOverlays(
  chosen: { readonly overlays?: readonly string[]; readonly style?: string } | undefined,
): readonly string[] | undefined {
  if (chosen?.overlays) return chosen.overlays;
  if (chosen?.style !== undefined) return chosen.style ? [chosen.style] : [];
  return undefined;
}

/** What a planet wears unless told otherwise: the style its data names, if any. */
export const ownOverlays = (style: string | undefined): readonly string[] => (style ? [style] : []);

/**
 * Whether an overlay a body wears is drawn, as its settings say from the nearest level down (each
 * overlay's own switch, else one kept for all before bodies wore several); none set: drawn.
 */
export function overlayOn(
  id: string,
  ...levels: readonly (BodySettings | undefined)[]
): boolean | undefined {
  for (const s of levels) {
    const on = s?.overlaysEnabled?.[id] ?? s?.overlayEnabled;
    if (on !== undefined) return on;
  }
  return undefined;
}

// What the design kept before bodies wore several overlays: their parts' keys named the overlay's
// part by its role alone (`style:shield`). They are read as the overlay they were set for.

const LEGACY_PART = /^style:([^:]+)$/;

const partKeyFor = (key: string, overlay: string) => {
  const m = LEGACY_PART.exec(key);
  return m ? `style:${overlay}:${m[1]}` : key;
};

function migrateParts(parts: PartSettingsMap | undefined, overlay: string) {
  if (!parts || !Object.keys(parts).some((k) => LEGACY_PART.test(k))) return parts;
  return Object.fromEntries(
    Object.entries(parts).map(([k, v]) => [partKeyFor(k, overlay), v]),
  ) as PartSettingsMap;
}

const migrateReceiver = (r: Receiver, overlay: string): Receiver =>
  r.startsWith('part:') ? (`part:${partKeyFor(r.slice(5), overlay)}` as Receiver) : r;

function migrateReach<T extends { readonly reach?: { readonly receivers: readonly Receiver[] } }>(
  light: T,
  overlay: string,
): T {
  const reach = light.reach;
  if (!reach?.receivers.some((r) => r.startsWith('part:style:'))) return light;
  return {
    ...light,
    reach: { ...reach, receivers: reach.receivers.map((r) => migrateReceiver(r, overlay)) },
  };
}

function migrateLights(lights: LightSettingsMap | undefined, overlay: string) {
  if (!lights) return lights;
  return Object.fromEntries(
    Object.entries(lights).map(([id, l]) => [id, l ? migrateReach(l, overlay) : l]),
  ) as LightSettingsMap;
}

// What the design kept before an overlay's materials' settings were kept by the overlay too
// (`materialKey`): by their names alone, shared with any material of the same name. They are read
// as the overlays' they were set for.

/**
 * The game data's overlays' materials then: its only planet overlay's, and the sky's energy (split
 * out of the sky's own as an overlay; set as the sky's before).
 */
const LEGACY_MATERIALS: Readonly<Record<string, readonly string[]>> = {
  nexus: ['atmospherePlanetLarge', 'material10-play-large'],
  'horizon-energy': ['horizonEnergy'],
};

/**
 * What a material's name kept settings for is read as (none: as it is): the keys of the overlays'
 * materials it was set for, and whether it stays set by its name too (where it may be the
 * owner's own as well).
 */
type Rekey = (
  name: string,
) => { readonly keys: readonly string[]; readonly keep: boolean } | undefined;

/** An overlay's own settings: every material's by its key (the overlay's). */
const ownedBy =
  (overlay: string): Rekey =>
  (name) =>
    name.startsWith('style:') ? undefined : { keys: [materialKey(name, overlay)], keep: false };

/**
 * A wearer's settings (a body's, or a sky's): the names of overlays' materials, by their keys; the
 * game data's moved (no planet, nor the sky, has one of their names), those made in the editor
 * copied (a name of one may be the wearer's own too).
 */
function wornBy(made: Readonly<Record<string, readonly string[]>>, data: readonly string[]): Rekey {
  const owners = [
    ...data.map((overlay) => ({ overlay, names: LEGACY_MATERIALS[overlay] ?? [], keep: false })),
    ...Object.entries(made).map(([overlay, names]) => ({ overlay, names, keep: true })),
  ];
  return (name) => {
    const of = owners.filter((o) => o.names.includes(name));
    return of.length
      ? { keys: of.map((o) => materialKey(name, o.overlay)), keep: of.some((o) => o.keep) }
      : undefined;
  };
}

function rekeyMaterials(
  map: MaterialSettingsMap | undefined,
  rekey: Rekey,
): MaterialSettingsMap | undefined {
  if (!map || !Object.keys(map).some((k) => rekey(k))) return map;
  const out = { ...map };
  for (const [name, settings] of Object.entries(map)) {
    const r = rekey(name);
    if (!r) continue;
    for (const key of r.keys) if (!(key in map)) out[key] = settings; // set by its key: as it is
    if (!r.keep) delete out[name];
  }
  return out;
}

function rekeyOrder(order: readonly string[] | undefined, rekey: Rekey) {
  if (!order?.some((k) => rekey(k))) return order;
  return [
    ...new Set(
      order.flatMap((name) => {
        const r = rekey(name);
        return r ? [...(r.keep ? [name] : []), ...r.keys] : [name];
      }),
    ),
  ];
}

function rekeyReach<T extends { readonly reach?: LightReach }>(light: T, rekey: Rekey): T {
  const reach = light.reach;
  const of = (r: Receiver) => (r.startsWith('material:') ? rekey(r.slice(9)) : undefined);
  if (!reach?.receivers.some(of)) return light;
  const receivers = reach.receivers.flatMap((r): Receiver[] => {
    const x = of(r);
    return x ? [...(x.keep ? [r] : []), ...x.keys.map((k): Receiver => `material:${k}`)] : [r];
  });
  return { ...light, reach: { ...reach, receivers: [...new Set(receivers)] } };
}

/** Settings (a body's, a sky's) with what was kept for overlays' materials by name read by their keys. */
function rekeyed<
  T extends {
    readonly materials?: MaterialSettingsMap;
    readonly order?: readonly string[];
    readonly lights?: LightSettingsMap;
    readonly added?: readonly AddedLight[];
  },
>(s: T, rekey: Rekey): T {
  const materials = rekeyMaterials(s.materials, rekey);
  const order = rekeyOrder(s.order, rekey);
  return {
    ...s,
    ...(materials ? { materials } : {}),
    ...(order ? { order } : {}),
    ...(s.lights
      ? {
          lights: Object.fromEntries(
            Object.entries(s.lights).map(([id, l]) => [id, l ? rekeyReach(l, rekey) : l]),
          ) as LightSettingsMap,
        }
      : {}),
    ...(s.added ? { added: s.added.map((l) => rekeyReach(l, rekey)) } : {}),
  };
}

/**
 * A body's settings with what named an overlay's part by its role alone read as `overlay`'s, and
 * what was kept for overlays' materials by their names alone by their keys (`rekey`; none: as it is).
 */
export function migrateSettings(
  s: BodySettings | undefined,
  overlay: string,
  rekey?: Rekey,
): BodySettings | undefined {
  if (!s) return s;
  const out = {
    ...s,
    ...(s.parts ? { parts: migrateParts(s.parts, overlay) } : {}),
    ...(s.lights ? { lights: migrateLights(s.lights, overlay) } : {}),
    ...(s.added ? { added: s.added.map((l): AddedLight => migrateReach(l, overlay)) } : {}),
  };
  return rekey ? rekeyed(out, rekey) : out;
}

/** The overlay a variant was kept for: its key's, where it names one (else the one there was). */
const variantOverlay = (key: string) => (key && !key.includes('+') ? key : LEGACY_OVERLAY);

function migrateVariants(
  variants: Readonly<Record<string, BodySettings>> | undefined,
  rekey: Rekey,
) {
  if (!variants) return variants;
  return Object.fromEntries(
    Object.entries(variants).map(([k, s]) => [
      k,
      migrateSettings(s, variantOverlay(k), rekey) ?? s,
    ]),
  );
}

function migrateMoons(
  moons: readonly MoonChoices[] | undefined,
  rekey: Rekey,
): readonly MoonChoices[] | undefined {
  return moons?.map((m) => ({
    ...m,
    ...(m.settings
      ? { settings: migrateSettings(m.settings, chosenOverlays(m)?.[0] ?? LEGACY_OVERLAY, rekey) }
      : {}),
    ...(m.moons ? { moons: migrateMoons(m.moons, rekey) } : {}),
  }));
}

const migrateBody = (b: SceneBody, rekey: Rekey): SceneBody => ({
  ...b,
  ...(b.variants ? { variants: migrateVariants(b.variants, rekey) } : {}),
  ...(b.moons ? { moons: migrateMoons(b.moons, rekey) } : {}),
});

function migrateScene(p: PlanetChoices, body: Rekey, sky: Rekey): PlanetChoices {
  return {
    ...p,
    ...(p.bodies ? { bodies: p.bodies.map((b) => migrateBody(b, body)) } : {}),
    ...(p.variants ? { variants: migrateVariants(p.variants, body) } : {}),
    ...(p.moons ? { moons: migrateMoons(p.moons, body) } : {}),
    ...(p.sky ? { sky: rekeyed<SkyChoices>(p.sky, sky) } : {}),
  };
}

function migrateLibrary(l: LibraryState, body: Rekey, sky: Rekey): LibraryState {
  const each = (
    bodies: Readonly<Record<string, BodySettings>>,
    overlay: (id: string) => string,
    rekey: (id: string) => Rekey,
  ) =>
    Object.fromEntries(
      Object.entries(bodies).map(([id, s]) => [
        id,
        migrateSettings(s, overlay(id), rekey(id)) ?? s,
      ]),
    );
  return {
    ...l,
    planets: each(
      l.planets ?? {},
      () => LEGACY_OVERLAY,
      () => body,
    ),
    styles: each(l.styles ?? {}, (id) => id, ownedBy),
    sky: rekeyed(l.sky ?? {}, sky),
    ...(l.created ? { created: migrateCreated(l.created) } : {}),
  };
}

/**
 * Overlays made in the editor as kept before their materials were kept by where they are: with
 * copies of them (`materials`, `textures`), not where they came from. Those are dropped (which
 * file a copy came from isn't kept): their parts draw them again once they are picked again.
 */
function migrateCreated(created: NonNullable<LibraryState['created']>) {
  if (Object.values(created).every((o) => o.sources)) return created;
  return Object.fromEntries(
    Object.entries(created).map(([id, o]): [string, CreatedOverlay] => [
      id,
      o.sources ? o : { kind: o.kind, label: o.label, parts: o.parts, sources: {} },
    ]),
  );
}

/** The materials an overlay made in the editor draws, by its id, for those worn on `kind`. */
const madeMaterials = (l: LibraryState, kind: 'planet' | 'sky') =>
  Object.fromEntries(
    Object.entries(l.created ?? {})
      .filter(([, o]) => o.kind === kind)
      .map(([id, o]) => [id, [...new Set(o.parts.flatMap((p) => p.materials))]]),
  );

/** Bodies' moons with an overlay taken off each that wears it (by choice: its own is its data's). */
function moonsWithout(moons: readonly MoonChoices[] | undefined, id: string) {
  return moons?.map((m): MoonChoices => ({
    ...m,
    ...(m.overlays ? { overlays: m.overlays.filter((o) => o !== id) } : {}),
    ...(m.moons ? { moons: moonsWithout(m.moons, id) } : {}),
  }));
}

/** A scene with an overlay (one made in the editor, deleted) taken off every body, and the sky, wearing it. */
export function sceneWithout(p: PlanetChoices, id: string): PlanetChoices {
  return {
    ...p,
    ...(p.bodies
      ? {
          bodies: p.bodies.map((b): SceneBody => ({
            ...b,
            ...(b.overlays ? { overlays: b.overlays.filter((o) => o !== id) } : {}),
            ...(b.moons ? { moons: moonsWithout(b.moons, id) } : {}),
          })),
        }
      : {}),
    ...(p.sky?.overlays
      ? { sky: { ...p.sky, overlays: p.sky.overlays.filter((o) => o !== id) } }
      : {}),
  };
}

/**
 * A design as kept, read as it is now: what named an overlay's part by its role alone (before
 * bodies wore several overlays) named by the overlay it was set for; what was kept for an
 * overlay's materials by their names alone (before they were kept by the overlay too) by their
 * keys; scenes' planets, moons and group placements given keys (`keyedScene`); each one tint kept
 * before objects had several the first of its list (`migrateTints`); the scenes' one Colour kept
 * before scenes were graded the first of each scene's grading (`graded`). A design kept since is
 * as it is.
 */
export function migrateDesign(design: Design): Design {
  design = graded(migrateTints(design));
  const planets = design.scenes?.planets ?? {};
  const body = wornBy(madeMaterials(design.library, 'planet'), [LEGACY_OVERLAY]);
  const sky = wornBy(madeMaterials(design.library, 'sky'), ['horizon-energy']);
  return {
    library: migrateLibrary(design.library, body, sky),
    scenes: {
      planets: Object.fromEntries(
        Object.entries(planets).map(([k, p]) => [
          k,
          keyedScene(migrateScene(p, body, sky), design.library),
        ]),
      ),
    },
  };
}

/**
 * A design with the scenes' one Colour kept before scenes were graded (`scenes.settings`) as the
 * first tint of each scene's grading (not a group's, nor the preview stage's), and taken out.
 */
function graded(design: Design): Design {
  const kept = (design.scenes as { settings?: Parameters<typeof keptColourTint>[0] } | undefined)
    ?.settings;
  if (!kept) return design;
  const first = keptColourTint(kept);
  const planets = Object.fromEntries(
    Object.entries(design.scenes.planets ?? {}).map(([id, p]) => {
      if (!first || p.group || id === PREVIEW_SCENE) return [id, p];
      const tints = p.grading?.tints ?? [];
      if (tints.some((t) => t.id === first.id)) return [id, p];
      return [id, { ...p, grading: { ...p.grading, tints: [first, ...tints] } }];
    }),
  );
  return { ...design, scenes: { planets } };
}
