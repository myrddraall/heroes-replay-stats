import { InjectionToken } from '@angular/core';
import type { PlanetFile } from './planet-files';
/**
 * Planets the app makes itself rather than loading an exported file (an editor's stand-in): their
 * ids start with this, which no exported planet's does.
 */
export const BUILT_IN_PREFIX = '@';

/**
 * A planet the app makes: its file, what it is called, and how to make the images of the textures
 * it makes itself (the rest are fetched as its file says).
 */
export interface BuiltInPlanet {
  readonly planet: PlanetFile;
  readonly label?: string;
  readonly images?: Readonly<Record<string, () => Promise<ImageBitmap>>>;
}

/** The planets the app makes, by id (none for an id it doesn't make). */
export type BuiltInPlanets = (id: string) => BuiltInPlanet | undefined;

/**
 * The planets the app makes where a background is shown (none by default: the site shows only
 * exported ones; an editor provides its aids under it).
 */
export const BUILT_IN_PLANETS = new InjectionToken<BuiltInPlanets>('BUILT_IN_PLANETS');
