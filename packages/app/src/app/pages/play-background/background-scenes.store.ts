import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import type {
  MaterialSettings,
  MaterialSettingsMap,
  MaterialTint,
} from '../../scenes/play-background/scene-planets';
import { withLocalStorage } from '../../data/store-features/with-local-storage';
import {
  addMoon,
  type BodyPath,
  type BodySettings,
  changeMoon,
  DEFAULT_ORBIT,
  moonAt,
  type MoonChoices,
  type Orbit,
  type PlanetChoices,
  without,
} from './background-scene';
import { type PartTint, PRESETS, type TintSettings, UNTINTED } from './tint-settings';

/** Where the scenes are kept (the Background page's choices, as they were kept before). */
export const BACKGROUND_SCENES_KEY = 'hrs.background-page';

/** The global tint's choice that is set by hand. */
export const CUSTOM_TINT = 'custom';

interface ScenesState {
  /** The colour over the whole picture. */
  readonly settings: TintSettings;
  /** The sky's materials' settings, by name. */
  readonly sky: MaterialSettingsMap;
  /** A tint over the whole sky (its stars too); none: as the data has it. */
  readonly skyTint: MaterialTint | null;
  /** Each planet's scene, by the planet's id. */
  readonly planets: Readonly<Record<string, PlanetChoices>>;
}

/**
 * The Background page's scenes (global): for each planet, the style it wears and its look in each
 * style, and its moons (each its own look and orbit, its own moons); the sky's materials and a
 * tint over the whole sky; and the colour over the whole picture. Kept in `localStorage`. What is set here is set over what the
 * game data and its tuning give: taking a setting back gives the data's again.
 * A planet's own settings are kept by the style it wears (its look in that style): whoever changes
 * them says which style that is.
 */
export const BackgroundScenesStore = signalStore(
  { providedIn: 'root' },
  withState<ScenesState>({ settings: UNTINTED, sky: {}, skyTint: null, planets: {} }),
  withLocalStorage<ScenesState>(BACKGROUND_SCENES_KEY, ['settings', 'sky', 'skyTint', 'planets']),
  withProps(() => ({ _root: inject(DOCUMENT).documentElement })),
  withMethods((store) => {
    const planet = (id: string): PlanetChoices => store.planets()[id] ?? {};
    const setPlanet = (id: string, change: (p: PlanetChoices) => PlanetChoices | null) => {
      const next = { ...store.planets() };
      const changed = change(planet(id));
      if (changed) next[id] = changed;
      else delete next[id];
      patchState(store, { planets: next });
    };
    const setMoons = (id: string, moons: readonly MoonChoices[]) =>
      setPlanet(id, (p) => ({ ...p, moons }));
    /** A body's settings changed: the planet's in `style`, a moon's its own. */
    const updateBody = (
      id: string,
      path: BodyPath,
      style: string,
      change: (s: BodySettings) => BodySettings | undefined,
    ) => {
      if (path.length) {
        setMoons(
          id,
          changeMoon(planet(id).moons ?? [], path, (m) => ({
            ...m,
            settings: change(m.settings ?? {}),
          })),
        );
        return;
      }
      setPlanet(id, (p) => {
        const variants = { ...p.variants };
        const changed = change(variants[style] ?? {});
        if (changed) variants[style] = changed;
        else delete variants[style];
        return { ...p, variants };
      });
    };
    return {
      /** The style a body wears (''; none): the planet's chosen here, a moon's its own. */
      setStyle(id: string, path: BodyPath, style: string): void {
        if (path.length)
          setMoons(
            id,
            changeMoon(planet(id).moons ?? [], path, (m) => ({ ...m, style: style || undefined })),
          );
        else setPlanet(id, (p) => ({ ...p, style }));
      },
      /** A body's style back to its own (the planet's tuning's; a moon none). */
      resetStyle(id: string, path: BodyPath): void {
        if (path.length)
          setMoons(
            id,
            changeMoon(planet(id).moons ?? [], path, (m) => ({ ...m, style: undefined })),
          );
        else setPlanet(id, (p) => ({ ...p, style: undefined }));
      },
      setBody(id: string, path: BodyPath, style: string, change: Partial<BodySettings>): void {
        updateBody(id, path, style, (s) => ({ ...s, ...change }));
      },
      /** A body's settings taken back, so they are its own again. */
      clearBody(
        id: string,
        path: BodyPath,
        style: string,
        keys: readonly (keyof BodySettings)[],
      ): void {
        updateBody(id, path, style, (s) => without(s, keys));
      },
      /** A body's look back to its own: the planet's in `style`, or a moon's (its orbit kept). */
      resetBody(id: string, path: BodyPath, style: string): void {
        updateBody(id, path, style, () => undefined);
      },
      setMaterial(
        id: string,
        path: BodyPath,
        style: string,
        name: string,
        change: Partial<MaterialSettings>,
      ): void {
        updateBody(id, path, style, (s) => ({
          ...s,
          materials: { ...s.materials, [name]: { ...s.materials?.[name], ...change } },
        }));
      },
      /** A material's settings taken back (all of them: `keys` left out). */
      clearMaterial(
        id: string,
        path: BodyPath,
        style: string,
        name: string,
        keys?: readonly (keyof MaterialSettings)[],
      ): void {
        updateBody(id, path, style, (s) => {
          const materials = { ...s.materials };
          const left = keys ? without(materials[name], keys) : undefined;
          if (left) materials[name] = left;
          else delete materials[name];
          return without({ ...s, materials }, Object.keys(materials).length ? [] : ['materials']);
        });
      },
      setOrbit(id: string, path: BodyPath, change: Partial<Orbit>): void {
        setMoons(
          id,
          changeMoon(planet(id).moons ?? [], path, (m) => ({
            ...m,
            orbit: { ...m.orbit, ...change },
          })),
        );
      },
      /** A moon, by its planet's id, added about a body: its path. */
      addMoon(id: string, parent: BodyPath, moon: string): BodyPath {
        const moons = planet(id).moons ?? [];
        const count = parent.length ? (moonAt(moons, parent)?.moons?.length ?? 0) : moons.length;
        setMoons(id, addMoon(moons, parent, { id: moon, orbit: DEFAULT_ORBIT }));
        return [...parent, count];
      },
      /** A moon taken out, with its own moons. */
      removeMoon(id: string, path: BodyPath): void {
        setMoons(
          id,
          changeMoon(planet(id).moons ?? [], path, () => null),
        );
      },
      /** A planet's whole scene back as the data has it: its style, its looks, its moons. */
      resetPlanet(id: string): void {
        setPlanet(id, () => null);
      },
      setSkyMaterial(name: string, change: Partial<MaterialSettings>): void {
        patchState(store, { sky: { ...store.sky(), [name]: { ...store.sky()[name], ...change } } });
      },
      /** A sky material's settings taken back (all of them: `keys` left out). */
      clearSkyMaterial(name: string, keys?: readonly (keyof MaterialSettings)[]): void {
        const sky = { ...store.sky() };
        const left = keys ? without(sky[name], keys) : undefined;
        if (left) sky[name] = left;
        else delete sky[name];
        patchState(store, { sky });
      },
      setSkyTint(skyTint: MaterialTint): void {
        patchState(store, { skyTint });
      },
      clearSkyTint(): void {
        patchState(store, { skyTint: null });
      },
      /** The sky back as the data has it: its materials and its tint. */
      resetSky(): void {
        patchState(store, { sky: {}, skyTint: null });
      },
      /**
       * The colour over the whole picture chosen: a preset by id (the first: none, its colour read
       * from the theme), or Custom, which starts from the tint there is and is set by hand.
       */
      chooseTint(choice: string): void {
        if (choice === CUSTOM_TINT) {
          patchState(store, {
            settings: { choice, background: { ...store.settings().background, on: true } },
          });
          return;
        }
        const preset = PRESETS.find((p) => p.id === choice);
        if (!preset) return;
        const colour = preset.token
          ? getComputedStyle(store._root).getPropertyValue(preset.token).trim()
          : '#ffffff';
        patchState(store, {
          settings: {
            choice,
            background: { on: preset.token !== null, colour, blend: preset.blend },
          },
        });
      },
      /** The custom tint changed in part. */
      setTint(change: Partial<PartTint>): void {
        const settings = store.settings();
        patchState(store, {
          settings: { ...settings, background: { ...settings.background, ...change } },
        });
      },
      resetTint(): void {
        patchState(store, { settings: UNTINTED });
      },
    };
  }),
);
