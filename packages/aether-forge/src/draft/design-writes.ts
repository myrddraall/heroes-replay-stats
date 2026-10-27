import type { Signal } from '@angular/core';
import { patchState, type WritableStateSource } from '@ngrx/signals';
import type { Design } from '@myrddraall/heroes-replay-stats-aether/design';
import type { LibraryState } from '@myrddraall/heroes-replay-stats-aether/library';
import {
  type BodySettings,
  ownScene,
  type PlanetChoices,
  type ScenesState,
  type SkyChoices,
  without,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { MaterialSettings } from '@myrddraall/heroes-replay-stats-aether/materials';
/** Which of the library's bodies: a planet's defaults, or a style's. */
export type LibraryKind = 'planets' | 'styles';

/** A sky with one material's changed, or taken back; its tint set or taken back. */
export function skyMaterial(
  sky: SkyChoices,
  name: string,
  change: Partial<MaterialSettings> | null,
  keys?: readonly (keyof MaterialSettings)[],
): SkyChoices {
  const materials = { ...sky.materials };
  if (change) materials[name] = { ...materials[name], ...change };
  else {
    const left = keys ? without(materials[name], keys) : undefined;
    if (left) materials[name] = left;
    else delete materials[name];
  }
  return { ...sky, materials: Object.keys(materials).length ? materials : undefined };
}

/** A sky with what isn't set taken out (nothing set: none). */
export function tidySky(sky: SkyChoices): SkyChoices | undefined {
  const kept = Object.fromEntries(Object.entries(sky).filter(([, v]) => v !== undefined));
  return Object.keys(kept).length ? (kept as SkyChoices) : undefined;
}

/** Records equal as kept (as JSON): for what is unsaved. */
export const same = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The keys of two records whose entries differ. */
export function differing(
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>,
): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !same(a[k], b[k]));
}

/** A draft's design as its writes change it. */
export type DesignWritable = WritableStateSource<Design> & {
  readonly library: Signal<LibraryState>;
  readonly scenes: Signal<ScenesState>;
};

/** The writes every part of the draft makes its changes through. */
export function designWrites(store: DesignWritable) {
  const setLibrary = (change: (l: LibraryState) => LibraryState) =>
    patchState(store, { library: change(store.library()) });
  const setScenes = (change: (s: ScenesState) => ScenesState) =>
    patchState(store, { scenes: change(store.scenes()) });
  const scene = (id: string): PlanetChoices => store.scenes().planets[id] ?? {};
  /**
   * A scene changed. One with nothing left set is dropped, but for a scene of the user's own
   * (not a preset or the stage), which stays listed.
   */
  const setScene = (id: string, change: (p: PlanetChoices) => PlanetChoices | null) =>
    setScenes((s) => {
      const planets = { ...s.planets };
      const changed = change(scene(id));
      if (changed && Object.values(changed).some((v) => v !== undefined)) planets[id] = changed;
      else if (ownScene(id)) planets[id] = {};
      else delete planets[id];
      return { ...s, planets };
    });
  const setSceneSky = (id: string, change: (sky: SkyChoices) => SkyChoices) =>
    setScene(id, (p) => ({ ...p, sky: tidySky(change(p.sky ?? {})) }));
  /** A library body's defaults changed (none left: none kept). */
  const updateLibraryBody = (
    kind: LibraryKind,
    id: string,
    change: (s: BodySettings) => BodySettings | undefined,
  ) =>
    setLibrary((l) => {
      const bodies = { ...l[kind] };
      const changed = change(bodies[id] ?? {});
      if (changed && Object.keys(changed).length) bodies[id] = changed;
      else delete bodies[id];
      return { ...l, [kind]: bodies };
    });
  const setLibrarySky = (change: (sky: SkyChoices) => SkyChoices) =>
    setLibrary((l) => ({ ...l, sky: tidySky(change(l.sky)) ?? {} }));
  /** A sky changed: a scene's (by its id), or the library's (null). */
  const changeSky = (scene: string | null, change: (sky: SkyChoices) => SkyChoices) =>
    scene === null ? setLibrarySky(change) : setSceneSky(scene, change);
  return {
    setLibrary,
    setScenes,
    scene,
    setScene,
    setSceneSky,
    updateLibraryBody,
    setLibrarySky,
    changeSky,
  };
}
