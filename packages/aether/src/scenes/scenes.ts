import type { PlanetChoices } from './scene-settings';
import { type TintSettings, UNTINTED } from '../tints/tint-settings';

/** The scenes: each a planet with its moons and a sky of its own (the random sets' under ''), and the colour over the whole picture. */
export interface ScenesState {
  readonly settings: TintSettings;
  readonly planets: Readonly<Record<string, PlanetChoices>>;
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

export const EMPTY_SCENES: ScenesState = { settings: UNTINTED, planets: {} };
