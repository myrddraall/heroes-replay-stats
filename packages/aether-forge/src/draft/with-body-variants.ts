import {
  type BodySettings,
  type BodyVariant,
  type Design,
  MADE_VARIANT,
  without,
} from '@myrddraall/heroes-replay-stats-aether/design';
import { signalStoreFeature, type, withMethods } from '@ngrx/signals';
import { designWrites } from './design-writes';

/** A planet's own variants (see `variants.ts`): made here, or changes to its data's. */
export function withBodyVariants() {
  return signalStoreFeature(
    { state: type<Design>() },
    withMethods((store) => {
      const { updateLibraryBody } = designWrites(store);
      return {
        /** A new variant of a planet (named, holding `settings`: none, nothing yet), after its others; its id. */
        createVariant(planet: string, name: string, settings?: BodySettings): string {
          const taken = new Set((store.library().planets[planet]?.variants ?? []).map((v) => v.id));
          let n = 1;
          while (taken.has(`${MADE_VARIANT}${n}`)) n++;
          const id = `${MADE_VARIANT}${n}`;
          updateLibraryBody('planets', planet, (s) => ({
            ...s,
            variants: [
              ...(s.variants ?? []),
              { id, name, ...(settings && Object.keys(settings).length ? { settings } : {}) },
            ],
          }));
          return id;
        },
        /**
         * A variant of a planet changed (its settings; a data variant's: the changes to it, kept as
         * the library's entry for it); one of the data's with nothing changed left: no entry.
         */
        changeVariant(
          planet: string,
          variant: string,
          change: (v: BodyVariant) => BodyVariant,
        ): void {
          updateLibraryBody('planets', planet, (s) => {
            const list = s.variants ?? [];
            const at = list.findIndex((v) => v.id === variant);
            const changed = change(at >= 0 ? list[at]! : { id: variant });
            const tidy: BodyVariant = {
              id: changed.id,
              ...(changed.name !== undefined ? { name: changed.name } : {}),
              ...(changed.settings && Object.keys(changed.settings).length
                ? { settings: changed.settings }
                : {}),
            };
            const kept =
              !variant.startsWith(MADE_VARIANT) && Object.keys(tidy).length === 1 ? null : tidy;
            const next = at >= 0 ? list.map((v, i) => (i === at ? kept : v)) : [...list, kept];
            const variants = next.filter((v): v is BodyVariant => !!v);
            return without({ ...s, variants }, variants.length ? [] : ['variants']);
          });
        },
        /** A variant made here deleted (off wherever it was on in the library too). */
        deleteVariant(planet: string, variant: string): void {
          updateLibraryBody('planets', planet, (s) => {
            const variants = (s.variants ?? []).filter((v) => v.id !== variant);
            const on = s.variantsOn?.filter((id) => id !== variant);
            return without(
              { ...s, variants, ...(on ? { variantsOn: on } : {}) },
              variants.length ? [] : ['variants'],
            );
          });
        },
        /** Which of a planet's variants are on by default (none given: none set: its data's, none). */
        setVariantsOn(planet: string, on: readonly string[] | undefined): void {
          updateLibraryBody('planets', planet, (s) =>
            on ? { ...s, variantsOn: on } : without(s, ['variantsOn']),
          );
        },
      };
    }),
  );
}
