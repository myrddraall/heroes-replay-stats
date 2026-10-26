import {
  type Variant,
  variantSettingsOf,
  variantsOf,
  variantsOnOf,
} from '@myrddraall/heroes-replay-stats-aether/design';
import type { VariantRow } from '../../variants/variant-list';
import { computed } from '@angular/core';
import { type BodyInfo } from '../../editing/model/body';
import type { PickChoice } from '../../controls/pick-list';
import type { AssetStoreBase } from '../asset-editor.store';

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
