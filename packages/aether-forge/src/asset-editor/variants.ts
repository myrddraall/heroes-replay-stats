import {
  type Variant,
  variantSettingsOf,
  variantsOf,
  variantsOnOf,
} from '@myrddraall/heroes-replay-stats-aether/variants';
import type { VariantRow } from '../variants/variant-list';
import { computed } from '@angular/core';
import type { BodyInfo } from '../bodies/body';
import type { PickChoice } from '../controls/pick-list';
import type { AssetMethodsStore, AssetStoreBase } from './asset-editor.store';
import { patchState } from '@ngrx/signals';
import type { AssetWrites } from './asset-writes';
import { ASSET, ASSET_VARIANTS, assetVariantKey } from './asset-targets';

/** The planet's variants: its data's and those made here, the one edited, which are on, and the level edits go into. */
export function assetVariantViews(store: AssetStoreBase) {
  const { asset, _catalog, _draft, variantEdited } = store;
  const library = _draft.library;
  /** The planet open's variants: its data's (with the library's changes), then those made here. */
  const variants = computed((): readonly Variant[] => {
    const a = asset();
    return a.kind === 'planet'
      ? variantsOf(_catalog.dataVariants().get(a.id), library().planets[a.id])
      : [];
  });
  /** The variant edited, where it is one of the planet open's (else none: its own settings). */
  const variantOpen = computed(() => {
    const id = variantEdited();
    return id && variants().some((v) => v.id === id) ? id : null;
  });
  /**
   * The planet open's levels as edited: its own settings, its variants on (by default) over them;
   * or one of its variants edited: its changes, over its own settings, its variants on before it
   * and the variant's data's settings, under those on after it.
   */
  const planetLevels = (
    id: string,
  ): Pick<BodyInfo, 'settings' | 'below' | 'variantsBelow' | 'above'> => {
    const own = library().planets[id];
    const on = variantsOnOf(own);
    const edited = variantOpen();
    const named = (v: Variant) =>
      v.layers.map((settings) => ({ name: `the ${v.name} variant`, settings }));
    if (!edited)
      return {
        settings: own ?? {},
        above: variants()
          .filter((v) => on.includes(v.id))
          .flatMap(named),
      };
    const at = variants().findIndex((v) => v.id === edited);
    const variant = variants()[at]!;
    const kept = own?.variants?.find((v) => v.id === edited);
    const before = variants()
      .slice(0, at)
      .filter((v) => on.includes(v.id));
    const after = variants()
      .slice(at + 1)
      .filter((v) => on.includes(v.id));
    // (A data variant's own settings, under its changes here: its first layer, where it has one.)
    const data =
      !variant.made && kept?.settings
        ? variant.layers.slice(0, -1)
        : variant.made
          ? []
          : variant.layers;
    return {
      // (Its name as the name edited: renamed there, the variant is.)
      settings: { ...kept?.settings, label: variant.name },
      below: own,
      variantsBelow: [
        ...before.flatMap(named),
        ...data.map((settings) => ({ name: `the ${variant.name} variant (its data)`, settings })),
      ],
      above: after.flatMap(named),
    };
  };
  return {
    variantOpen,
    _planetLevels: planetLevels,
    _variants: variants,
    /** The planet open's variants as its properties list them: each one's name, whether on by default, made here. */
    variantRows: computed((): readonly VariantRow[] => {
      const a = asset();
      const on = a.kind === 'planet' ? variantsOnOf(library().planets[a.id]) : [];
      return variants().map((v) => ({
        id: v.id,
        name: v.name,
        on: on.includes(v.id),
        removable: v.made,
      }));
    }),
    /** Whether which of the planet open's variants are on is set in the library. */
    variantsOnSet: computed(() => {
      const a = asset();
      return a.kind === 'planet' && library().planets[a.id]?.variantsOn !== undefined;
    }),
    /** Whether variants are made and edited here: a planet open. */
    variantsEditable: computed(() => asset().kind === 'planet'),
    /** Whether the planet open has changes of its own a variant can take (and none is edited). */
    variantFromChangesOffered: computed(() => {
      const a = asset();
      if (a.kind !== 'planet' || variantOpen()) return false;
      return Object.keys(variantSettingsOf(library().planets[a.id] ?? {}).variant).length > 0;
    }),
    /** The levels edited here: a planet's own settings, then each of its variants. */
    layerOptions: computed((): readonly PickChoice[] => {
      const a = asset();
      if (a.kind !== 'planet' || !variants().length) return [];
      return [
        { value: '', label: library().planets[a.id]?.label ?? a.id },
        ...variants().map((v) => ({ value: v.id, label: v.name })),
      ];
    }),
    layer: computed(() => variantOpen() ?? ''),
    variantEdited: variantOpen,
  };
}

/** The planet's variants: edited, made, switched on, deleted, renamed. */
export function assetVariantMethods(store: AssetMethodsStore, w: AssetWrites) {
  const { draft, asset } = w;
  /** A variant just made edited, its row shown in its Variants and selected. */
  const shown = (id: string) => {
    store.expand(ASSET, ASSET_VARIANTS);
    patchState(store, { variantEdited: id, selected: assetVariantKey(id) });
  };
  return {
    // The planet open's variants.
    /** The variant of the planet open edited (what is set goes into it), or its own settings (none). */
    editVariant(id: string | null): void {
      patchState(store, { variantEdited: id });
    },
    /** A new variant of the planet open, edited and selected. */
    newVariant(): void {
      const a = asset();
      if (a.kind !== 'planet') return;
      const id = draft.createVariant(a.id, `Variant ${store._variants().length + 1}`);
      shown(id);
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
      shown(id);
    },
    /** A variant of the planet open switched on or off by default. */
    setVariantOn(id: string, on: boolean): void {
      w.variantOn(id, on);
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
