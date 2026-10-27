import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { withLocalStorage } from '@myrddraall/heroes-replay-stats-signals';
import type { Design } from './design';
import { EMPTY_LIBRARY } from '../library/library';
import { EMPTY_SCENES, type ScenesState } from '../scenes/scenes';
import type { PlanetChoices } from '../scenes/scene-settings';
import { migrateDesign } from '../overlays/overlays';
import { storageKey } from '../storage/storage-names';

/** Where the published design is kept. */
const PUBLISHED_DESIGN_KEY = storageKey('design');
/** Where the scenes were kept before the design was published and drafted (read once, to carry them over). */
const OLD_SCENES_KEY = storageKey('page');

/** The scenes kept before there was a published design (under `key`), if any. */
function oldScenes(key: string): ScenesState | null {
  try {
    const raw = localStorage.getItem(key);
    const old = raw ? (JSON.parse(raw) as Partial<ScenesState>) : null;
    return old?.planets
      ? { settings: old.settings ?? EMPTY_SCENES.settings, planets: old.planets }
      : null;
  } catch {
    return null;
  }
}

/**
 * The background's published design (global): what the site shows, the library's defaults on its
 * random sets. Kept in `localStorage`; changed only by publishing a draft (the Background page's
 * Save). Scenes kept by the page before there were drafts are carried over the first time.
 */
export const PublishedDesignStore = signalStore(
  { providedIn: 'root' },
  withState<Design>({ library: EMPTY_LIBRARY, scenes: EMPTY_SCENES }),
  withLocalStorage<Design>(PUBLISHED_DESIGN_KEY, ['library', 'scenes']),
  withProps(() => ({ _key: PUBLISHED_DESIGN_KEY(), _oldKey: OLD_SCENES_KEY() })),
  withMethods((store) => ({
    /** A design published: the site shows it from now on. */
    publish(design: Design): void {
      patchState(store, { library: design.library, scenes: design.scenes });
    },
    /** Nothing published: the site's random sets, the game data's defaults (the old scenes' key gone too). */
    clear(): void {
      patchState(store, { library: EMPTY_LIBRARY, scenes: EMPTY_SCENES });
      try {
        localStorage.removeItem(store._oldKey);
      } catch {
        // nowhere it was kept
      }
    },
    /** One scene published as it is (a new one starts saved), the rest as they were. */
    publishScene(id: string, scene: PlanetChoices): void {
      const scenes = store.scenes();
      patchState(store, { scenes: { ...scenes, planets: { ...scenes.planets, [id]: scene } } });
    },
  })),
  withHooks({
    onInit(store) {
      let kept = false;
      try {
        kept = localStorage.getItem(store._key) !== null;
      } catch {
        // nothing kept: nothing to carry over either
      }
      const old = kept ? null : oldScenes(store._oldKey);
      if (old) patchState(store, { scenes: old });
      // What was kept before bodies wore several overlays, read as it is now.
      patchState(store, migrateDesign({ library: store.library(), scenes: store.scenes() }));
    },
  }),
);
