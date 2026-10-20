import type { BodySettings, MoonChoices, PlanetChoices, SceneBody } from './background-scene';
import type { Design, LibraryState } from './background-design';
import type { AddedLight, LightSettingsMap, Receiver } from './scene-lights';
import type { PartSettingsMap } from './scene-planets';

/**
 * Overlays: what a body (or the sky) wears over its own, several at once, the later over the
 * earlier. An overlay is the game data's (a style's file, `style-<id>`), or one made in the
 * editor (its id starting `@overlay-`, kept in the design's library and built there).
 */

/** The overlay the design's settings meant before bodies wore several: the only one there was. */
export const LEGACY_OVERLAY = 'nexus';
/** What the ids of overlays made in the editor start with. */
export const CREATED_OVERLAY = '@overlay-';
/** Whether an overlay is one made in the editor. */
export const createdOverlay = (id: string) => id.startsWith(CREATED_OVERLAY);

/**
 * The file an overlay is loaded from: the game data's style file, or one made in the editor (its
 * own id; `revision` tells a changed one apart, so it is built again).
 */
export const overlayFile = (id: string, revision?: string) =>
  createdOverlay(id) ? (revision ? `${id}#${revision}` : id) : `style-${id}`;
/** The overlay a loaded file is of (its file's id, as `overlayFile` makes it). */
export const overlayOfFile = (file: string) =>
  createdOverlay(file) ? file.split('#')[0]! : file.replace(/^style-/, '');

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

/** A body's settings with what named an overlay's part by its role alone read as `overlay`'s. */
export function migrateSettings(
  s: BodySettings | undefined,
  overlay: string,
): BodySettings | undefined {
  if (!s) return s;
  return {
    ...s,
    ...(s.parts ? { parts: migrateParts(s.parts, overlay) } : {}),
    ...(s.lights ? { lights: migrateLights(s.lights, overlay) } : {}),
    ...(s.added ? { added: s.added.map((l): AddedLight => migrateReach(l, overlay)) } : {}),
  };
}

/** The overlay a variant was kept for: its key's, where it names one (else the one there was). */
const variantOverlay = (key: string) => (key && !key.includes('+') ? key : LEGACY_OVERLAY);

function migrateVariants(variants: Readonly<Record<string, BodySettings>> | undefined) {
  if (!variants) return variants;
  return Object.fromEntries(
    Object.entries(variants).map(([k, s]) => [k, migrateSettings(s, variantOverlay(k)) ?? s]),
  );
}

function migrateMoons(
  moons: readonly MoonChoices[] | undefined,
): readonly MoonChoices[] | undefined {
  return moons?.map((m) => ({
    ...m,
    ...(m.settings
      ? { settings: migrateSettings(m.settings, chosenOverlays(m)?.[0] ?? LEGACY_OVERLAY) }
      : {}),
    ...(m.moons ? { moons: migrateMoons(m.moons) } : {}),
  }));
}

const migrateBody = (b: SceneBody): SceneBody => ({
  ...b,
  ...(b.variants ? { variants: migrateVariants(b.variants) } : {}),
  ...(b.moons ? { moons: migrateMoons(b.moons) } : {}),
});

function migrateScene(p: PlanetChoices): PlanetChoices {
  return {
    ...p,
    ...(p.bodies ? { bodies: p.bodies.map(migrateBody) } : {}),
    ...(p.variants ? { variants: migrateVariants(p.variants) } : {}),
    ...(p.moons ? { moons: migrateMoons(p.moons) } : {}),
  };
}

function migrateLibrary(l: LibraryState): LibraryState {
  const each = (bodies: Readonly<Record<string, BodySettings>>, overlay: (id: string) => string) =>
    Object.fromEntries(
      Object.entries(bodies).map(([id, s]) => [id, migrateSettings(s, overlay(id)) ?? s]),
    );
  return {
    ...l,
    planets: each(l.planets ?? {}, () => LEGACY_OVERLAY),
    styles: each(l.styles ?? {}, (id) => id),
  };
}

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
 * bodies wore several overlays) named by the overlay it was set for. A design kept since is as it is.
 */
export function migrateDesign(design: Design): Design {
  const planets = design.scenes?.planets ?? {};
  return {
    library: migrateLibrary(design.library),
    scenes: {
      ...design.scenes,
      planets: Object.fromEntries(Object.entries(planets).map(([k, p]) => [k, migrateScene(p)])),
    },
  };
}
