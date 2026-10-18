import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { withLocalStorage } from '../../data/store-features/with-local-storage';
import { type Design, EMPTY_LIBRARY, EMPTY_SCENES, type ScenesState } from './background-design';

/** Where the published design is kept. */
export const PUBLISHED_DESIGN_KEY = 'hrs.background-design';
/** Where the scenes were kept before the design was published and drafted (read once, to carry them over). */
const OLD_SCENES_KEY = 'hrs.background-page';

/** The scenes kept before there was a published design, if any. */
function oldScenes(): ScenesState | null {
  try {
    const raw = localStorage.getItem(OLD_SCENES_KEY);
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
  withMethods((store) => ({
    /** A design published: the site shows it from now on. */
    publish(design: Design): void {
      patchState(store, { library: design.library, scenes: design.scenes });
    },
  })),
  withHooks({
    onInit(store) {
      let kept = false;
      try {
        kept = localStorage.getItem(PUBLISHED_DESIGN_KEY) !== null;
      } catch {
        // nothing kept: nothing to carry over either
      }
      const old = kept ? null : oldScenes();
      if (old) patchState(store, { scenes: old });
    },
  }),
);
