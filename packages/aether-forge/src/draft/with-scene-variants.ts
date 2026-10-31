import type { Design } from '@myrddraall/heroes-replay-stats-aether/design';
import { without } from '@myrddraall/heroes-replay-stats-aether/scenes';
import {
  BILLBOARD_SCENE_VARIANT,
  givenSceneVariant,
  MADE_VARIANT,
  type SceneVariant,
} from '@myrddraall/heroes-replay-stats-aether/variants';
import { signalStoreFeature, type, withMethods } from '@ngrx/signals';
import { designWrites } from './design-writes';

/** A scene's own variants (see `SceneVariant`): each switches its planets' variants. */
export function withSceneVariants() {
  return signalStoreFeature(
    { state: type<Design>() },
    withMethods((store) => {
      const { setScene } = designWrites(store);
      return {
        /** A new variant of a scene (named), after its others; its id. */
        createSceneVariant(id: string, name: string): string {
          const taken = new Set((store.scenes().planets[id]?.sceneVariants ?? []).map((v) => v.id));
          let n = 1;
          while (taken.has(`${MADE_VARIANT}${n}`)) n++;
          const variant = `${MADE_VARIANT}${n}`;
          setScene(id, (p) => ({
            ...p,
            sceneVariants: [...(p.sceneVariants ?? []), { id: variant, name }],
          }));
          return variant;
        },
        /**
         * A scene's variant changed (its name, what it switches); one every scene has, kept as
         * the scene's changes to it (first) once changed.
         */
        changeSceneVariant(
          id: string,
          variant: string,
          change: (v: SceneVariant) => SceneVariant,
        ): void {
          setScene(id, (p) => {
            const own = p.sceneVariants ?? [];
            const kept = own.some((v) => v.id === variant);
            if (!kept && givenSceneVariant(variant)) {
              // (What it switches for every planet stays the given variant's, never kept here.)
              const { id: given, name, switches } = change(BILLBOARD_SCENE_VARIANT);
              const changed: SceneVariant = { id: given, name, ...(switches ? { switches } : {}) };
              return { ...p, sceneVariants: [changed, ...own] };
            }
            return { ...p, sceneVariants: own.map((v) => (v.id === variant ? change(v) : v)) };
          });
        },
        /** A scene's variant deleted (off too). */
        deleteSceneVariant(id: string, variant: string): void {
          setScene(id, (p) => {
            const sceneVariants = (p.sceneVariants ?? []).filter((v) => v.id !== variant);
            const on = (p.sceneVariantsOn ?? []).filter((v) => v !== variant);
            return (
              without({ ...p, sceneVariants, sceneVariantsOn: on }, [
                ...(sceneVariants.length ? [] : ['sceneVariants' as const]),
                ...(on.length ? [] : ['sceneVariantsOn' as const]),
              ]) ?? {}
            );
          });
        },
        /** Which of a scene's own variants are on (none: none). */
        setSceneVariantsOn(id: string, on: readonly string[]): void {
          setScene(id, (p) =>
            on.length ? { ...p, sceneVariantsOn: on } : (without(p, ['sceneVariantsOn']) ?? {}),
          );
        },
      };
    }),
  );
}
