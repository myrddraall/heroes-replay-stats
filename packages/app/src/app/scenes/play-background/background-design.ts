import type { Signal } from '@angular/core';
import type { BodySettings, PlanetChoices, SkyChoices } from './background-scene';
import { mergeMaterialSettings } from './material-settings';
import type { SetPlanet } from './planet-sets';
import type { BodyShade, SkySettings } from './scene-planets';
import { type TintSettings, UNTINTED } from './tint-settings';

/**
 * The background's design: how its assets show wherever they appear (the library), and the
 * scenes composed of them. Each sets only what it changes, over the game data and its tuning:
 * the data, then the library, then a scene. What the site uses is the published design; the
 * Background page edits a draft of it, which Save publishes.
 */

/** The library: each asset's defaults, wherever it appears (the site's random sets too). */
export interface LibraryState {
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

export const EMPTY_LIBRARY: LibraryState = { planets: {}, styles: {}, sky: {} };
export const EMPTY_SCENES: ScenesState = { settings: UNTINTED, planets: {} };

/** The design as read where it is used: the published one at the root, the draft under the Background page. */
export interface BackgroundDesign {
  readonly library: Signal<LibraryState>;
  readonly scenes: Signal<ScenesState>;
}

/**
 * What a background shows, where something other than the site's random sets is to be shown (an
 * editor's scene): its planets (null: the random sets), its sky, and its tint over the whole
 * picture (null: the site's).
 */
export interface BackgroundSceneSource {
  readonly planets: Signal<readonly SetPlanet[] | null>;
  readonly sky: Signal<SkySettings>;
  readonly tint: Signal<TintSettings | null>;
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
 * (each set value where nothing above sets it), its materials' settings merged by name.
 */
export function withLibrary(planet: SetPlanet, library: LibraryState): SetPlanet {
  const own = library.planets[planet.id];
  const style = planet.style ? library.styles[planet.style] : undefined;
  if (!own && !style) return planet;
  return {
    ...planet,
    materials: mergeMaterialSettings(own?.materials, style?.materials, planet.materials),
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
    materials: mergeMaterialSettings(library.sky.materials, sky?.materials),
    tint: sky?.tint ?? library.sky.tint,
  };
}
