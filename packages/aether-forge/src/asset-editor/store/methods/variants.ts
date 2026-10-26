import { variantSettingsOf, variantsOnOf } from '@myrddraall/heroes-replay-stats-aether/design';
import { patchState } from '@ngrx/signals';
import type { AssetMethodsStore } from '../../asset-editor.store';
import type { AssetWrites } from './asset-writes';

/** The planet's variants: edited, made, switched on, deleted, renamed. */
export function assetVariantMethods(store: AssetMethodsStore, w: AssetWrites) {
  const { draft, asset } = w;
  return {
    // The planet open's variants.
    /** The variant of the planet open edited (what is set goes into it), or its own settings (none). */
    editVariant(id: string | null): void {
      patchState(store, { variantEdited: id });
    },
    /** A new variant of the planet open, edited. */
    newVariant(): void {
      const a = asset();
      if (a.kind !== 'planet') return;
      const id = draft.createVariant(a.id, `Variant ${store._variants().length + 1}`);
      patchState(store, { variantEdited: id });
    },
    /**
     * The planet open's own changes made into a new variant of it (what a variant can take of
     * them: see `variantSettingsOf`), taken off it and the variant switched on, so it looks the
     * same; edited.
     */
    variantFromChanges(): void {
      const a = asset();
      if (a.kind !== 'planet' || store.variantOpen()) return;
      const own = draft.library().planets[a.id] ?? {};
      const { variant, kept } = variantSettingsOf(own);
      if (!Object.keys(variant).length) return;
      const on = variantsOnOf(own);
      const id = draft.createVariant(a.id, `Variant ${store._variants().length + 1}`, variant);
      draft.changeLibraryBody('planets', a.id, (s) => ({
        ...kept,
        variants: s.variants,
        variantsOn: [...on, id],
      }));
      patchState(store, { variantEdited: id });
    },
    /** A variant of the planet open switched on or off by default. */
    setVariantOn(id: string, on: boolean): void {
      const a = asset();
      if (a.kind !== 'planet') return;
      const now = variantsOnOf(draft.library().planets[a.id]);
      draft.setVariantsOn(
        a.id,
        on ? [...now.filter((v) => v !== id), id] : now.filter((v) => v !== id),
      );
    },
    /** Which of the planet open's variants are on by default back as its data has them (none). */
    resetVariantsOn(): void {
      const a = asset();
      if (a.kind === 'planet') draft.setVariantsOn(a.id, undefined);
    },
    /** A variant of the planet open made here deleted (its own settings edited again if it was edited). */
    deleteVariant(id: string): void {
      const a = asset();
      if (a.kind !== 'planet') return;
      draft.deleteVariant(a.id, id);
      if (store.variantEdited() === id) patchState(store, { variantEdited: null });
    },
    /** A variant of the planet open renamed. */
    renameVariant(id: string, name: string): void {
      const a = asset();
      if (a.kind === 'planet') draft.changeVariant(a.id, id, (v) => ({ ...v, name }));
    },
  };
}
