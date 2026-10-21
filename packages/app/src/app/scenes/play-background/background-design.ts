import type { Signal } from '@angular/core';
import type { BodySettings, MoonChoices, PlanetChoices, SkyChoices } from './background-scene';
import { mergeMaterialSettings } from './material-settings';
import { type AddedLight, mergeLightSettings } from './scene-lights';
import { type CreatedOverlay, mergeAddedParts } from './created-overlays';
import { createdOverlay, overlayOn } from './overlays';
import type { SetPlanet } from './planet-sets';
import {
  type BodyShade,
  type MaterialSettingsMap,
  mergePartSettings,
  type SkySettings,
} from './scene-planets';
import type { Backdrop } from './scene-renderer';
import type { LightAid } from './scene-beams';
import type { SceneCameraSet } from './play-scene';
import { type TintSettings, UNTINTED } from './tint-settings';

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

/** The scenes: each a planet with its moons and a sky of its own (the random sets' under ''), and the colour over the whole picture. */
export interface ScenesState {
  readonly settings: TintSettings;
  readonly planets: Readonly<Record<string, PlanetChoices>>;
}

export interface Design {
  readonly library: LibraryState;
  readonly scenes: ScenesState;
}

/** The scene the site's random sets are shown with (their sky, their moons none). */
export const RANDOM_SCENE = '';
/**
 * The preview stage's scene: what is around an asset while it is edited in the library (its sky).
 * A scene of its own, kept and saved as the others are, under a key no scene is given.
 */
export const PREVIEW_SCENE = '@preview';
/** The game's own Play screen: its three planets where it puts them (a preset scene). */
export const PLAY_SCREEN_SCENE = 'play-screen';
/** Whether a scene is one of those the editor lists (not the preview stage). */
export const listedScene = (id: string) => id !== PREVIEW_SCENE;
/** The scenes the editor comes with: the random sets, the game's own Play screen. */
export const PRESET_SCENES: readonly string[] = [RANDOM_SCENE, PLAY_SCREEN_SCENE];
/**
 * Whether a scene is one of the user's own (named, of a planet, deletable): not a preset or the
 * stage.
 */
export const ownScene = (id: string) => !PRESET_SCENES.includes(id) && id !== PREVIEW_SCENE;

export const EMPTY_LIBRARY: LibraryState = { materials: {}, planets: {}, styles: {}, sky: {} };
export const EMPTY_SCENES: ScenesState = { settings: UNTINTED, planets: {} };

/** The design as read where it is used: the published one at the root, the draft under the Background page. */
export interface BackgroundDesign {
  readonly library: Signal<LibraryState>;
  readonly scenes: Signal<ScenesState>;
}

/**
 * What a background shows, where something other than the site's random sets is to be shown (an
 * editor's scene): its planets (null while what they need loads: what was shown stays), or the
 * random sets (`random`); its sky, and its tint over the whole picture (null: the site's).
 */
export interface BackgroundSceneSource {
  readonly planets: Signal<readonly SetPlanet[] | null>;
  /** Whether it shows the random sets (its planets are none of its own). */
  readonly random?: Signal<boolean>;
  /** Its sky as set (over the library's): its materials, tint, order, and the overlays it wears. */
  readonly sky: Signal<SkyChoices>;
  /** The scene's lights, lighting every planet (none: none). */
  readonly lights?: Signal<readonly AddedLight[]>;
  readonly tint: Signal<TintSettings | null>;
  /** An editing aid shown in place of the sky (none: the sky); never part of the design. */
  readonly backdrop?: Signal<Backdrop | null>;
  /** Lights' beams shown over it (an editing aid: the light selected); never part of the design. */
  readonly beams?: Signal<readonly LightAid[]>;
  /** Where it puts the camera, over the game's (none: the game's). */
  readonly camera?: Signal<SceneCameraSet | undefined>;
  /**
   * Which scene this is (an editor's open scene or asset): its planets changing under the same
   * one are drawn again in place (faded), not flown to; another one is flown to.
   */
  readonly key?: Signal<string>;
}

/** A shade from a body's settings: what of it is set (strength, direction), the rest left to what is under it. */
export function shadeOf(settings: BodySettings | undefined): Partial<BodyShade> {
  return {
    ...(settings?.shade !== undefined ? { strength: settings.shade } : {}),
    ...(settings?.shadeTowards ? { direction: settings.shadeTowards } : {}),
  };
}

/**
 * A planet as the library has it, under what is set for it: its own defaults and its style's
 * (each set value where nothing above sets it), its materials' settings merged by key over the
 * materials' base settings.
 */
export function withLibrary(set: SetPlanet, library: LibraryState): SetPlanet {
  const own = library.planets[set.id];
  // Each overlay switched off (by the scene, else the library): drawn as if it didn't wear it;
  // one made in the editor that is no longer there, as if it never was.
  const on = (id: string) =>
    (!createdOverlay(id) || !!library.created?.[id]) &&
    (set.overlaysEnabled?.[id] ?? set.overlayEnabled ?? overlayOn(id, own)) !== false;
  const overlays = (set.overlays ?? []).filter(on);
  const planet: SetPlanet =
    overlays.length === (set.overlays ?? []).length ? set : { ...set, overlays };
  const styles = overlays.map((id) => library.styles[id]).filter((s) => !!s);
  const base = library.materials;
  if (!own && !styles.length && !Object.keys(base ?? {}).length) return planet;
  const orders = styles.flatMap((s) => (s.order ? [s.order] : []));
  return {
    ...planet,
    // (An overlay's materials kept by their `materialKey`, at every level: the base by name.)
    materials: mergeMaterialSettings(
      base,
      own?.materials,
      ...styles.map((s) => s.materials),
      planet.materials,
    ),
    ...(base ? { base } : {}),
    parts: mergePartSettings(own?.parts, ...styles.map((s) => s.parts), planet.parts),
    addedParts: mergeAddedParts(own?.addedParts, planet.addedParts),
    order: planet.order ?? own?.order ?? (orders.length ? orders.flat() : undefined),
    lights: mergeLightSettings(own?.lights, ...styles.map((s) => s.lights), planet.lights),
    added: [
      ...(own?.added ?? []),
      ...styles.flatMap((s) => s.added ?? []),
      ...(planet.added ?? []),
    ],
    lighting: planet.lighting ?? own?.lighting,
    tint: planet.tint ?? own?.tint,
    lightFrom: planet.lightFrom ?? own?.lightFrom,
    rim: planet.rim ?? own?.rim,
    shade: {
      ...shadeOf(own),
      ...styles.reduce((a: Partial<BodyShade>, s) => ({ ...a, ...shadeOf(s) }), {}),
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
    order: sky?.order ?? library.sky.order,
    overlays,
    parts: mergePartSettings(...styles.map((s) => s?.parts), library.sky.parts, sky?.parts),
    addedParts: mergeAddedParts(library.sky.addedParts, sky?.addedParts),
  };
}
