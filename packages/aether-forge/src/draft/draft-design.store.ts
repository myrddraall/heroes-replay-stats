import { storageKey } from '@myrddraall/heroes-replay-stats-aether';
import { type Design, PublishedDesignStore } from '@myrddraall/heroes-replay-stats-aether/design';
import { migrateDesign } from '@myrddraall/heroes-replay-stats-aether/overlays';
import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  signalStoreFeature,
  type,
  withHooks,
  withState,
} from '@ngrx/signals';
import { withLocalStorage } from '@myrddraall/heroes-replay-stats-signals';
import { withDesignHistory } from './with-design-history';
import { withPublishing } from './with-publishing';
import { withLibraryBodies } from './with-library-bodies';
import { withBodyVariants } from './with-body-variants';
import { withCreatedOverlays } from './with-created-overlays';
import { withSkies } from './with-skies';
import { withScenes } from './with-scenes';
import { withSceneVariants } from './with-scene-variants';
import { withTint } from './with-tint';

/** Where the draft is kept between visits (until it is saved or discarded). */
const DRAFT_KEY = storageKey('draft');

/** Every write a draft takes, and what of it is unsaved: each part of the design its own feature. */
function withDraftWrites() {
  return signalStoreFeature(
    { state: type<Design>() },
    withPublishing(),
    withLibraryBodies(),
    withBodyVariants(),
    withCreatedOverlays(),
    withSkies(),
    withScenes(),
    withSceneVariants(),
    withTint(),
  );
}

/**
 * The Background page's draft of the design (component store, provided by the page): its library
 * and scenes as edited there, seeded from the published design ({@link PublishedDesignStore}) and
 * kept between visits until saved (published: the site shows it) or discarded (the published one
 * again). It is what the page's background and panels show: the page provides it as the design in
 * effect for everything under it. Every edit at every level lands here.
 */
export const DraftDesignStore = signalStore(
  withState<Design>(() => {
    const published = inject(PublishedDesignStore);
    return { library: published.library(), scenes: published.scenes() };
  }),
  withLocalStorage<Design>(DRAFT_KEY, ['library', 'scenes']),
  withHooks({
    onInit(store) {
      // A draft kept before bodies wore several overlays, read as it is now.
      patchState(store, migrateDesign({ library: store.library(), scenes: store.scenes() }));
    },
  }),
  withDesignHistory(),
  withDraftWrites(),
);
