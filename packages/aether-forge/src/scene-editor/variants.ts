import { pathKey, without } from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { VariantRow } from '../variants/variant-list';
import { computed } from '@angular/core';
import type { PickChoice } from '../controls/pick-list';
import { bodyKey } from './scene-targets';
import type { SceneMethodsStore, WithBackground } from './scene-editor.store';
import { switched } from '@myrddraall/heroes-replay-stats-aether/variants';
import { patchState } from '@ngrx/signals';
import type { SceneWrites } from './scene-writes';

/** The variants: the scene's own and its planets', which are on, and the level edits go into. */
export function variantViews(store: WithBackground) {
  const choices = computed(() => store._draft.scenes().planets[store.scene()] ?? {});
  /** The scene's variant edited, where it is one of the scene's. */
  const sceneVariantOpen = computed(() => {
    const id = store.sceneVariantEdited();
    return id && (choices().sceneVariants ?? []).some((v) => v.id === id) ? id : null;
  });
  /** The body selected, where one is (or one of its materials, parts, lights). */
  const selectedBody = computed(() => {
    const t = store.target();
    return 'path' in t ? store.bodyByKey().get(bodyKey(t.path)) : undefined;
  });
  return {
    sceneVariantOpen,
    /** The scene's own variants as listed: each one's name, whether on. */
    sceneVariantRows: computed((): readonly VariantRow[] =>
      (choices().sceneVariants ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        on: (choices().sceneVariantsOn ?? []).includes(v.id),
        removable: true,
      })),
    ),
    sceneVariantsOnSet: computed(() => (choices().sceneVariantsOn ?? []).length > 0),
    /** The selected body's variants, each on or off where it is (in the scene, with its variants). */
    variantRows: computed((): readonly VariantRow[] => {
      const b = selectedBody();
      return (b?.variants ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        on: (b?.variantsOn ?? []).includes(v.id),
        removable: false,
      }));
    }),
    // (A planet's variants are made and edited in the library; here they are switched.)
    variantsEditable: computed(() => false),
    variantEdited: computed((): string | null => null),
    variantFromChangesOffered: computed(() => false),
    /** Whether which of the selected body's variants are on is set at the level edited. */
    variantsOnSet: computed(() => {
      const b = selectedBody();
      const t = store.target();
      if (!b || !('path' in t)) return false;
      const open = sceneVariantOpen();
      return open
        ? (choices().sceneVariants ?? []).find((v) => v.id === open)?.switches?.[
            pathKey(t.path)
          ] !== undefined
        : b.settings.variantsOn !== undefined;
    }),
    /** The levels edited here: the scene itself, then each of its own variants. */
    layerOptions: computed((): readonly PickChoice[] => {
      const variants = choices().sceneVariants ?? [];
      return variants.length
        ? [{ value: '', label: 'Scene' }, ...variants.map((v) => ({ value: v.id, label: v.name }))]
        : [];
    }),
    layer: computed(() => sceneVariantOpen() ?? ''),
  };
}

/** The variants: a planet's (which are on in the scene) and the scene's own. */
export function variantMethods(store: SceneMethodsStore, w: SceneWrites) {
  const { d, selectedPath, settings } = w;
  return {
    // Variants: the selected body's switched (into the scene, or the scene's variant edited);
    // the scene's own made, switched, edited, renamed, deleted.
    setVariantOn(id: string, on: boolean): void {
      const path = selectedPath();
      if (path) w.variantOn(path, id, on);
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
