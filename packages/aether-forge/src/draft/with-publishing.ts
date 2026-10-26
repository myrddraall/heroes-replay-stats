import {
  type Design,
  EMPTY_LIBRARY,
  EMPTY_SCENES,
  PublishedDesignStore,
} from '@myrddraall/heroes-replay-stats-aether/design';
import { computed, inject } from '@angular/core';
import { patchState, signalStoreFeature, type, withComputed, withMethods } from '@ngrx/signals';
import { differing, same } from './design-writes';

/** What of the draft differs from the published design, and saving it (publishing), discarding it or clearing all. */
export function withPublishing() {
  return signalStoreFeature(
    { state: type<Design>() },
    withComputed(({ library, scenes }) => {
      const published = inject(PublishedDesignStore);
      // (A planet's own moons are the planet's: changed, it is.)
      const changedPlanets = computed(() => [
        ...new Set([
          ...differing(library().planets, published.library().planets),
          ...differing(library().moons ?? {}, published.library().moons ?? {}),
        ]),
      ]);
      const changedStyles = computed(() => [
        ...new Set([
          ...differing(library().styles, published.library().styles),
          ...differing(library().created ?? {}, published.library().created ?? {}),
        ]),
      ]);
      const changedMaterials = computed(() =>
        differing(library().materials ?? {}, published.library().materials ?? {}),
      );
      const changedScenes = computed(() => differing(scenes().planets, published.scenes().planets));
      const skyChanged = computed(() => !same(library().sky, published.library().sky));
      const colourChanged = computed(() => !same(scenes().settings, published.scenes().settings));
      return {
        /** What is published, to compare with. */
        publishedScenes: computed(() => published.scenes()),
        publishedLibrary: computed(() => published.library()),
        /** The library's planets, styles and sky, and the scenes, that differ from what is published. */
        unsavedLibraryPlanets: computed(() => new Set(changedPlanets())),
        unsavedLibraryStyles: computed(() => new Set(changedStyles())),
        unsavedLibraryMaterials: computed(() => new Set(changedMaterials())),
        unsavedLibrarySky: skyChanged,
        unsavedScenes: computed(() => new Set(changedScenes())),
        unsavedColour: colourChanged,
        /** How many things differ from what is published (an asset, a scene, the sky, the colour). */
        unsaved: computed(
          () =>
            changedPlanets().length +
            changedStyles().length +
            changedMaterials().length +
            changedScenes().length +
            (skyChanged() ? 1 : 0) +
            (colourChanged() ? 1 : 0),
        ),
      };
    }),
    withMethods((store) => {
      const published = inject(PublishedDesignStore);
      return {
        /** The draft published: the site shows it from now on. */
        save(): void {
          published.publish({ library: store.library(), scenes: store.scenes() });
        },
        /** Everything saved and drafted thrown away: nothing published, nothing drafted. */
        clearAll(): void {
          published.clear();
          patchState(store, { library: EMPTY_LIBRARY, scenes: EMPTY_SCENES });
        },
        /** The draft thrown away: the published design again. */
        discard(): void {
          patchState(store, {
            library: published.library(),
            scenes: published.scenes(),
          });
        },
      };
    }),
  );
}
