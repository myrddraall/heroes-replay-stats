import { inject, InjectionToken, type Signal } from '@angular/core';
import type { SkyChoices } from '../scenes/scene-settings';
import { type AddedLight } from '../lights/lights';
import type { SetPlanet } from '../planet-sets/planet-sets';
import type { Backdrop } from '../space/space';
import type { EditingAid } from '../aids/beams';
import type { SceneCameraSet } from '../formats/play-scene';
import { type TintSettings } from '../tints/tint-settings';
import { PublishedDesignStore } from '../design/published-design.store';
import type { LibraryState } from '../library/library';
import type { ScenesState } from '../scenes/scenes';

/** The design as read where it is used: the published one at the root, the draft under the Background page. */
export interface DesignSource {
  readonly library: Signal<LibraryState>;
  readonly scenes: Signal<ScenesState>;
}

/**
 * What a background shows, where something other than the site's random sets is to be shown (an
 * editor's scene): its planets (null while what they need loads: what was shown stays), or the
 * random sets (`random`); its sky, and its tint over the whole picture (null: the site's).
 */
export interface SceneSource {
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
  readonly beams?: Signal<readonly EditingAid[]>;
  /** Where it puts the camera, over the game's (none: the game's). */
  readonly camera?: Signal<SceneCameraSet | undefined>;
  /**
   * The camera an anchored sky moves with (a viewing aid, never part of the design): null, the
   * one it is drawn through; else one put where this says, over the game's (none: null).
   */
  readonly skyFollow?: Signal<SceneCameraSet | null>;
  /**
   * Which scene this is (an editor's open scene or asset): its planets changing under the same
   * one are drawn again in place (faded), not flown to; another one is flown to.
   */
  readonly key?: Signal<string>;
}

/**
 * The design in effect for what is under it: the published design by default (what the site
 * shows), and under the Background page its draft, which the page provides in its place, so what
 * is shown and edited there is the draft while the rest of the site shows what is published.
 */
export const DESIGN_SOURCE = new InjectionToken<DesignSource>('DESIGN_SOURCE', {
  providedIn: 'root',
  factory: () => {
    const published = inject(PublishedDesignStore);
    return { library: published.library, scenes: published.scenes };
  },
});

/**
 * A scene to show in place of the site's random sets, for the background under whatever provides
 * it (an editor's scene); none provided: the random sets.
 */
export const SCENE_SOURCE = new InjectionToken<SceneSource>('SCENE_SOURCE');
