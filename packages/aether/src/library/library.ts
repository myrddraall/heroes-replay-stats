import type { MoonChoices, SkyChoices } from '../scenes/scene-settings';
import { type MaterialSettingsMap, mergeMaterialSettings } from '../materials/material-settings';
import { mergeLightSettings } from '../lights/lights';
import { type CreatedOverlay, mergeAddedParts } from '../overlays/created-overlays';
import { overlayOn } from '../overlays/overlays';
import { variantLayersOf, variantsOf, variantsOnOf } from '../variants/variants';
import type { SetPlanet } from '../planet-sets/planet-sets';
import type { BodyShade } from '../formats/planet-files';
import { mergePartSettings } from '../formats/part-shapes';
import type { SkySettings } from '../sky/sky-settings';
import type { BodySettings, BodyVariant } from '../bodies/body-settings';
import { createdOverlay } from '../formats/overlay-files';

/**
 * The background's design: how its assets show wherever they appear (the library), and the
 * scenes composed of them. Each sets only what it changes, over the game data and its tuning:
 * the data, then the library, then a scene. What the site uses is the published design; the
 * Background page edits a draft of it, which Save publishes.
 */

/**
 * The library: each asset's defaults, wherever it appears (the site's random sets too). A
 * material's base settings are its own, wherever it is used; a planet, style or the sky using it
 * can set it otherwise for itself, and a scene again for its own.
 */
export interface LibraryState {
  /** Each material's base settings, by its name (kept before materials had them: none). */
  readonly materials?: MaterialSettingsMap;
  /** Each planet's look, by its id (its own materials, light, shade, tint, directions). */
  readonly planets: Readonly<Record<string, BodySettings>>;
  /**
   * Each planet's own moons, by its id (each keyed): brought into every scene the planet is put
   * in, and the random sets, as the scene sets them (`SceneBody.moonsSet`).
   */
  readonly moons?: Readonly<Record<string, readonly MoonChoices[]>>;
  /** Each style's look, by its id (its parts' materials, its shade). */
  readonly styles: Readonly<Record<string, BodySettings>>;
  /** The sky's materials and a tint over all of it. */
  readonly sky: SkyChoices;
  /** The overlays made in the editor, by id (`@overlay-<n>`); their names and settings are in `styles`. */
  readonly created?: Readonly<Record<string, CreatedOverlay>>;
}

export const EMPTY_LIBRARY: LibraryState = { materials: {}, planets: {}, styles: {}, sky: {} };

/** A shade from a body's settings: what of it is set (strength, direction), the rest left to what is under it. */
export function shadeOf(settings: BodySettings | undefined): Partial<BodyShade> {
  return {
    ...(settings?.shade !== undefined ? { strength: settings.shade } : {}),
    ...(settings?.shadeTowards ? { direction: settings.shadeTowards } : {}),
  };
}

/** A body's orientation, axis, turn and base turn, the scene's over the library's, each where set. */
function orientationOf(
  set: SetPlanet,
  own: Pick<SetPlanet, 'orientation' | 'axis' | 'turn' | 'baseTurn'> | undefined,
): Pick<SetPlanet, 'orientation' | 'axis' | 'turn' | 'baseTurn'> {
  const orientation = set.orientation ?? own?.orientation;
  const axis = set.axis ?? own?.axis;
  const turn = set.turn ?? own?.turn;
  const baseTurn = set.baseTurn ?? own?.baseTurn;
  return {
    ...(orientation ? { orientation } : {}),
    ...(axis ? { axis } : {}),
    ...(turn !== undefined ? { turn } : {}),
    ...(baseTurn ? { baseTurn } : {}),
  };
}

/**
 * A body's settings as levels stack them, each setting the last level's that sets it (`levels`:
 * the lowest first).
 */
function stacked(levels: readonly (BodySettings | undefined)[]): BodySettings {
  const out: Record<string, unknown> = {};
  for (const level of levels)
    for (const [k, v] of Object.entries(level ?? {})) if (v !== undefined) out[k] = v;
  return out as BodySettings;
}

/**
 * A planet as the library has it, under what is set for it: what the overlays it wears set (shared,
 * each any of its settings: the later over the earlier), then its own defaults, then its variants
 * that are on (`data`: its data's, with the library's; on as `set` says, else as the library has
 * it for the planet), then what is set for it (a scene's); its materials' settings merged by key
 * over the materials' base settings. Flattened here, just before it is drawn: each level is kept
 * where it is, linked.
 */
export function withLibrary(
  set: SetPlanet,
  library: LibraryState,
  data?: readonly BodyVariant[],
): SetPlanet {
  const own = library.planets[set.id];
  // Its own levels, the lowest first: its own defaults, then its variants that are on.
  const mine = [
    own,
    ...variantLayersOf(variantsOf(data, own), set.variantsOn ?? variantsOnOf(own)),
  ];
  const nearestFirst = [...mine].reverse();
  // Each overlay switched off (by the scene, else a variant, else the library): drawn as if it
  // didn't wear it; one made in the editor that is no longer there, as if it never was.
  const on = (id: string) =>
    (!createdOverlay(id) || !!library.created?.[id]) &&
    (set.overlaysEnabled?.[id] ?? set.overlayEnabled ?? overlayOn(id, ...nearestFirst)) !== false;
  // What it wears: as chosen where it is put, else (its own) the library's choice for it, if any.
  const wears = set.ownOverlays && own?.overlays ? own.overlays : set.overlays;
  const overlays = (wears ?? []).filter(on);
  const planet: SetPlanet =
    wears === set.overlays && overlays.length === (wears ?? []).length ? set : { ...set, overlays };
  const styles = overlays.map((id) => library.styles[id]).filter((s) => !!s);
  const base = library.materials;
  if (mine.length === 1 && !own && !styles.length && !Object.keys(base ?? {}).length) return planet;
  const orders = styles.flatMap((s) => (s.order ? [s.order] : []));
  // Its overlays' (the later over the earlier), then its own levels: under what is set for it.
  const under = stacked([...styles, ...mine]);
  return {
    ...planet,
    // (An overlay's materials kept by their `materialKey`, at every level: the base by name.)
    materials: mergeMaterialSettings(
      base,
      ...styles.map((s) => s.materials),
      ...mine.map((s) => s?.materials),
      planet.materials,
    ),
    ...(base ? { base } : {}),
    parts: mergePartSettings(
      ...styles.map((s) => s.parts),
      ...mine.map((s) => s?.parts),
      planet.parts,
    ),
    addedParts: mergeAddedParts(own?.addedParts, planet.addedParts),
    // (Its own levels' order, the nearest that sets one; else its overlays' joined.)
    order:
      planet.order ??
      nearestFirst.find((s) => s?.order)?.order ??
      (orders.length ? orders.flat() : undefined),
    lights: mergeLightSettings(
      ...styles.map((s) => s.lights),
      ...mine.map((s) => s?.lights),
      planet.lights,
    ),
    added: [
      ...styles.flatMap((s) => s.added ?? []),
      ...mine.flatMap((s) => s?.added ?? []),
      ...(planet.added ?? []),
    ],
    lighting: planet.lighting ?? under.lighting,
    tint: planet.tint ?? under.tint,
    lightFrom: planet.lightFrom ?? under.lightFrom,
    rim: planet.rim ?? under.rim,
    ...orientationOf(planet, under),
    shade: {
      ...[...styles, ...mine].reduce((a: Partial<BodyShade>, s) => ({ ...a, ...shadeOf(s) }), {}),
      ...planet.shade,
    },
  };
}

/**
 * The overlays a sky wears, as a scene sets them over the library (each over its data's, `wears`),
 * switched on or off; one made in the editor that is no longer there, as if it never was.
 */
export function skyWornOf(
  sky: SkyChoices | undefined,
  library: LibraryState,
  wears: readonly string[] = [],
): string[] {
  const worn = sky?.overlays ?? library.sky.overlays ?? wears;
  return worn.filter((id) => !createdOverlay(id) || !!library.created?.[id]);
}

/** Whether an overlay a sky wears is drawn, as a scene sets it over the library (unset: drawn). */
export const skyOverlayOn = (sky: SkyChoices | undefined, library: LibraryState, id: string) =>
  (sky?.overlaysEnabled?.[id] ?? library.sky.overlaysEnabled?.[id]) !== false;

/** The overlays a sky wears and draws (see `skyWornOf`), those switched off left out. */
export function skyOverlaysOf(
  sky: SkyChoices | undefined,
  library: LibraryState,
  wears: readonly string[] = [],
): string[] {
  return skyWornOf(sky, library, wears).filter((id) => skyOverlayOn(sky, library, id));
}

/**
 * A sky as the library has it, under what a scene sets for it: its overlays (`wears`: its data's,
 * where neither sets them), their settings as the library has each (its materials' and parts'),
 * under the sky's own.
 */
export function skyWithLibrary(
  sky: SkyChoices | undefined,
  library: LibraryState,
  wears: readonly string[] = [],
): SkySettings {
  const overlays = skyOverlaysOf(sky, library, wears);
  const styles = overlays.map((id) => library.styles[id]);
  return {
    materials: mergeMaterialSettings(
      library.materials,
      ...styles.map((s) => s?.materials),
      library.sky.materials,
      sky?.materials,
    ),
    ...(library.materials ? { base: library.materials } : {}),
    tint: sky?.tint ?? library.sky.tint,
    anchor: sky?.anchor ?? library.sky.anchor,
    order: sky?.order ?? library.sky.order,
    overlays,
    parts: mergePartSettings(...styles.map((s) => s?.parts), library.sky.parts, sky?.parts),
    addedParts: mergeAddedParts(library.sky.addedParts, sky?.addedParts),
  };
}
