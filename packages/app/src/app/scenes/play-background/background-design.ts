import type { Signal } from '@angular/core';
import type { BodySettings, PlanetChoices, SkyChoices } from './background-scene';
import { mergeMaterialSettings } from './material-settings';
import { type AddedLight, mergeLightSettings } from './scene-lights';
import type { SetPlanet } from './planet-sets';
import {
  type BodyShade,
  type MaterialSettingsMap,
  mergePartSettings,
  type SkySettings,
} from './scene-planets';
import type { Backdrop } from './scene-renderer';
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
  /** Each style's look, by its id (its parts' materials, its shade). */
  readonly styles: Readonly<Record<string, BodySettings>>;
  /** The sky's materials and a tint over all of it. */
  readonly sky: SkyChoices;
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
  readonly sky: Signal<SkySettings>;
  /** The scene's lights, lighting every planet (none: none). */
  readonly lights?: Signal<readonly AddedLight[]>;
  readonly tint: Signal<TintSettings | null>;
  /** An editing aid shown in place of the sky (none: the sky); never part of the design. */
  readonly backdrop?: Signal<Backdrop | null>;
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
 * (each set value where nothing above sets it), its materials' settings merged by name over the
 * materials' base settings.
 */
export function withLibrary(set: SetPlanet, library: LibraryState): SetPlanet {
  const own = library.planets[set.id];
  // Its overlay switched off (by the scene, else the library): drawn as if it wore none.
  const worn = (set.overlayEnabled ?? own?.overlayEnabled) !== false;
  const planet = worn ? set : { ...set, style: undefined };
  const style = planet.style ? library.styles[planet.style] : undefined;
  const base = library.materials;
  if (!own && !style && !Object.keys(base ?? {}).length) return planet;
  return {
    ...planet,
    materials: mergeMaterialSettings(base, own?.materials, style?.materials, planet.materials),
    parts: mergePartSettings(own?.parts, style?.parts, planet.parts),
    order: planet.order ?? own?.order ?? style?.order,
    lights: mergeLightSettings(own?.lights, style?.lights, planet.lights),
    added: [...(own?.added ?? []), ...(style?.added ?? []), ...(planet.added ?? [])],
    lighting: planet.lighting ?? own?.lighting,
    tint: planet.tint ?? own?.tint,
    lightFrom: planet.lightFrom ?? own?.lightFrom,
    rim: planet.rim ?? own?.rim,
    shade: { ...shadeOf(own), ...shadeOf(style), ...planet.shade },
  };
}

/** A sky as the library has it, under what a scene sets for it. */
export function skyWithLibrary(sky: SkyChoices | undefined, library: LibraryState): SkySettings {
  return {
    materials: mergeMaterialSettings(library.materials, library.sky.materials, sky?.materials),
    tint: sky?.tint ?? library.sky.tint,
    order: sky?.order ?? library.sky.order,
  };
}
