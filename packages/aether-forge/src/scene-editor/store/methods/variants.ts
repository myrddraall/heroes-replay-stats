import {
  pathKey,
  switched,
  variantsOnOf,
  without,
} from '@myrddraall/heroes-replay-stats-aether/design';
import { patchState } from '@ngrx/signals';
import { bodyKey } from '../../scene-targets';
import type { SceneMethodsStore } from '../../scene-editor.store';
import type { SceneWrites } from './scene-writes';

/** The variants: a planet's (which are on in the scene) and the scene's own. */
export function variantMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d, selectedPath, settings } = w;
  return {
    // Variants: the selected body's switched (into the scene, or the scene's variant edited);
    // the scene's own made, switched, edited, renamed, deleted.
    setVariantOn(id: string, on: boolean): void {
      const path = selectedPath();
      if (!path) return;
      const open = store.sceneVariantOpen();
      if (open) {
        const key = pathKey(path);
        d.changeSceneVariant(store.scene(), open, (v) => ({
          ...v,
          switches: { ...v.switches, [key]: { ...v.switches?.[key], [id]: on } },
        }));
        return;
      }
      const b = store.bodyByKey().get(bodyKey(path));
      settings(path, (s) => {
        const now = variantsOnOf(s, b?.inherited?.settings, d.library().planets[b?.id ?? '']);
        return { ...s, variantsOn: switched(now, { [id]: on }) };
      });
    },
    resetVariantsOn(): void {
      const path = selectedPath();
      if (!path) return;
      const open = store.sceneVariantOpen();
      if (open) {
        const key = pathKey(path);
        d.changeSceneVariant(store.scene(), open, (v) => {
          const switches = { ...v.switches };
          delete switches[key];
          return { ...v, switches };
        });
        return;
      }
      settings(path, (s) => without(s, ['variantsOn']));
    },
    editVariant(): void {
      // (A planet's variants are edited in the library.)
    },
    newVariant(): void {
      // (Made in the library.)
    },
    variantFromChanges(): void {
      // (Made in the library.)
    },
    deleteVariant(): void {
      // (Deleted in the library.)
    },
    renameVariant(): void {
      // (Renamed in the library.)
    },
    newSceneVariant(): void {
      const n = (store._draft.scenes().planets[store.scene()]?.sceneVariants ?? []).length + 1;
      const id = d.createSceneVariant(store.scene(), `Variant ${n}`);
      patchState(store, { sceneVariantEdited: id });
    },
    setSceneVariantOn(id: string, on: boolean): void {
      const now = store._draft.scenes().planets[store.scene()]?.sceneVariantsOn ?? [];
      d.setSceneVariantsOn(store.scene(), switched(now, { [id]: on }));
    },
    resetSceneVariantsOn(): void {
      d.setSceneVariantsOn(store.scene(), []);
    },
    editSceneVariant(id: string | null): void {
      patchState(store, { sceneVariantEdited: id });
    },
    renameSceneVariant(id: string, name: string): void {
      d.changeSceneVariant(store.scene(), id, (v) => ({ ...v, name }));
    },
    deleteSceneVariant(id: string): void {
      d.deleteSceneVariant(store.scene(), id);
      if (store.sceneVariantEdited() === id) patchState(store, { sceneVariantEdited: null });
    },
  };
}
