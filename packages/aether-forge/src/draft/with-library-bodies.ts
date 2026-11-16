import type { Design } from '@myrddraall/heroes-replay-stats-aether/design';
import {
  type MoonChoices,
  withMaterial,
  without,
  withoutMaterial,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { MaterialSettings } from '@myrddraall/heroes-replay-stats-aether/materials';
import { signalStoreFeature, type, withMethods } from '@ngrx/signals';
import { designWrites, type LibraryKind } from './design-writes';
import type { BodySettings } from '@myrddraall/heroes-replay-stats-aether/bodies';

/** The library's bodies' defaults: a planet's or a style's settings, its moons and materials, and the materials' own base settings. */
export function withLibraryBodies() {
  return signalStoreFeature(
    { state: type<Design>() },
    withMethods((store) => {
      const { setLibrary, updateLibraryBody } = designWrites(store);
      return {
        setLibraryBody(kind: LibraryKind, id: string, change: Partial<BodySettings>): void {
          updateLibraryBody(kind, id, (s) => ({ ...s, ...change }));
        },
        clearLibraryBody(
          kind: LibraryKind,
          id: string,
          keys: readonly (keyof BodySettings)[],
        ): void {
          updateLibraryBody(kind, id, (s) => without(s, keys));
        },
        /** A library body's defaults changed as a whole, in one step (none left: none kept). */
        changeLibraryBody(
          kind: LibraryKind,
          id: string,
          change: (s: BodySettings) => BodySettings | undefined,
        ): void {
          updateLibraryBody(kind, id, change);
        },
        resetLibraryBody(kind: LibraryKind, id: string): void {
          updateLibraryBody(kind, id, () => undefined);
        },
        /** A planet's own moons as they are now (none: none kept). */
        setLibraryMoons(planet: string, moons: readonly MoonChoices[]): void {
          setLibrary((l) => {
            const all = { ...l.moons };
            if (moons.length) all[planet] = moons;
            else delete all[planet];
            return { ...l, moons: all };
          });
        },
        setLibraryMaterial(
          kind: LibraryKind,
          id: string,
          name: string,
          change: Partial<MaterialSettings>,
        ): void {
          updateLibraryBody(kind, id, (s) => withMaterial(s, name, change));
        },
        clearLibraryMaterial(
          kind: LibraryKind,
          id: string,
          name: string,
          keys?: readonly (keyof MaterialSettings)[],
        ): void {
          updateLibraryBody(kind, id, (s) => withoutMaterial(s, name, keys));
        },
        setLibraryBaseMaterial(name: string, change: Partial<MaterialSettings>): void {
          setLibrary((l) => ({
            ...l,
            materials: { ...l.materials, [name]: { ...l.materials?.[name], ...change } },
          }));
        },
        clearLibraryBaseMaterial(name: string, keys?: readonly (keyof MaterialSettings)[]): void {
          setLibrary((l) => {
            const materials = { ...l.materials };
            const left = keys ? without(materials[name], keys) : undefined;
            if (left) materials[name] = left;
            else delete materials[name];
            return { ...l, materials };
          });
        },
      };
    }),
  );
}
