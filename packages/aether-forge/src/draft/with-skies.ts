import type { Design } from '@myrddraall/heroes-replay-stats-aether/design';
import { type SkyChoices, without } from '@myrddraall/heroes-replay-stats-aether/scenes';
import type {
  AddedPart,
  PartKey,
  PartSettings,
} from '@myrddraall/heroes-replay-stats-aether/formats';
import type {
  MaterialSettings,
  MaterialTint,
} from '@myrddraall/heroes-replay-stats-aether/materials';
import type { SkyAnchor } from '@myrddraall/heroes-replay-stats-aether/sky';
import { signalStoreFeature, type, withMethods } from '@ngrx/signals';
import { designWrites, skyMaterial } from './design-writes';

/** The skies: the library's and each scene's, their materials, tint, order, overlays, parts and anchor. */
export function withSkies() {
  return signalStoreFeature(
    { state: type<Design>() },
    withMethods((store) => {
      const { setSceneSky, setLibrarySky, changeSky } = designWrites(store);
      return {
        setLibrarySkyMaterial(name: string, change: Partial<MaterialSettings>): void {
          setLibrarySky((sky) => skyMaterial(sky, name, change));
        },
        clearLibrarySkyMaterial(name: string, keys?: readonly (keyof MaterialSettings)[]): void {
          setLibrarySky((sky) => skyMaterial(sky, name, null, keys));
        },
        setLibrarySkyTint(tint: MaterialTint): void {
          setLibrarySky((sky) => ({ ...sky, tint }));
        },
        clearLibrarySkyTint(): void {
          setLibrarySky((sky) => ({ ...sky, tint: undefined }));
        },
        /** The library sky's materials' draw order (none: as the data has it). */
        setLibrarySkyOrder(order: readonly string[] | undefined): void {
          setLibrarySky((sky) => ({ ...sky, order }));
        },
        resetLibrarySky(): void {
          setLibrarySky(() => ({}));
        },
        /** The overlays a sky wears (a scene's, or the library's: null), in order; none: back to what is under it. */
        setSkyOverlays(scene: string | null, overlays: readonly string[] | undefined): void {
          changeSky(scene, (sky) => ({ ...sky, overlays }));
        },
        /** An overlay a sky wears switched on or off: back to what is under it where the same. */
        setSkyOverlayEnabled(scene: string | null, id: string, on: boolean, below: boolean): void {
          changeSky(scene, (sky) => {
            const enabled = { ...sky.overlaysEnabled };
            if (on === below) delete enabled[id];
            else enabled[id] = on;
            return { ...sky, overlaysEnabled: Object.keys(enabled).length ? enabled : undefined };
          });
        },
        /** The parts added onto a sky at its level (a scene's sky, or the library's: null); none: none. */
        setSkyAddedParts(scene: string | null, parts: readonly AddedPart[]): void {
          changeSky(scene, (sky) => ({ ...sky, addedParts: parts.length ? parts : undefined }));
        },
        /** How a sky is anchored against the camera (a scene's sky, or the library's: null); none: as under it. */
        setSkyAnchor(scene: string | null, anchor: SkyAnchor | undefined): void {
          changeSky(scene, (sky) => ({ ...sky, anchor }));
        },
        /** A sky's settings changed as a whole (a scene's sky, or the library's: null). */
        changeSky(scene: string | null, change: (sky: SkyChoices) => SkyChoices): void {
          changeSky(scene, change);
        },
        /** One of a sky's overlays' parts' settings changed (a scene's sky, or the library's: null). */
        setSkyPart(scene: string | null, key: PartKey, change: Partial<PartSettings>): void {
          changeSky(scene, (sky) => ({
            ...sky,
            parts: { ...sky.parts, [key]: { ...sky.parts?.[key], ...change } },
          }));
        },
        /** One of a sky's overlays' parts' settings taken back (all of it: `keys` left out). */
        clearSkyPart(
          scene: string | null,
          key: PartKey,
          keys?: readonly (keyof PartSettings)[],
        ): void {
          changeSky(scene, (sky) => {
            const parts: Partial<Record<PartKey, PartSettings>> = { ...sky.parts };
            const left = keys ? without(parts[key], keys) : undefined;
            if (left) parts[key] = left;
            else delete parts[key];
            return { ...sky, parts: Object.keys(parts).length ? parts : undefined };
          });
        },
        setSkyMaterial(id: string, name: string, change: Partial<MaterialSettings>): void {
          setSceneSky(id, (sky) => skyMaterial(sky, name, change));
        },
        clearSkyMaterial(
          id: string,
          name: string,
          keys?: readonly (keyof MaterialSettings)[],
        ): void {
          setSceneSky(id, (sky) => skyMaterial(sky, name, null, keys));
        },
        setSkyTint(id: string, tint: MaterialTint): void {
          setSceneSky(id, (sky) => ({ ...sky, tint }));
        },
        clearSkyTint(id: string): void {
          setSceneSky(id, (sky) => ({ ...sky, tint: undefined }));
        },
        /** A scene's sky's materials' draw order (none: as the library has it). */
        setSkyOrder(id: string, order: readonly string[] | undefined): void {
          setSceneSky(id, (sky) => ({ ...sky, order }));
        },
        resetSky(id: string): void {
          setSceneSky(id, () => ({}));
        },
      };
    }),
  );
}
