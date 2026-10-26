import { pathKey } from '@myrddraall/heroes-replay-stats-aether/design';
import type { VariantRow } from '../../variants/variant-list';
import { computed } from '@angular/core';
import type { PickChoice } from '../../controls/pick-list';
import { bodyKey } from '../scene-targets';
import type { WithBackground } from '../scene-editor.store';

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
