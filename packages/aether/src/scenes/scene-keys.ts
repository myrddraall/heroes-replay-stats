import type { LibraryState } from '../library/library';
import type { SceneVariant } from '../variants/variants';
import { withLibraryMoons } from './scene-moons';
import {
  type AddedCamera,
  BODY_KEY,
  type CameraPlacement,
  type GroupPlacement,
  siblingKey,
  type MoonChoices,
  PLACEMENT_KEY,
  type PlanetChoices,
  type SceneBody,
} from './scene-settings';

/** A path kept before bodies had keys: their places, joined by dots. */
const PLACES = /^\d+(\.\d+)*$/;

/**
 * A scene kept before its planets, its own moons and the groups put in it had keys, given them:
 * in order (`body-1`, `body-2`… planets and moons alike, `place-1`…), the same each time it is
 * read, so a draft and the design it was made from agree. What pointed at them by their places
 * (scene variants' switches, cameras placed about a planet) points at their keys. A scene kept
 * since is as it is.
 */
export function keyedScene(scene: PlanetChoices, library: LibraryState): PlanetChoices {
  const taken = new Set<string>();
  const collect = (
    list: readonly { readonly key?: string; readonly moons?: readonly MoonChoices[] }[],
  ) => {
    for (const b of list) {
      if (b.key !== undefined) taken.add(b.key);
      collect(b.moons ?? []);
    }
  };
  collect(scene.bodies ?? []);
  for (const g of scene.groups ?? []) if (g.key !== undefined) taken.add(g.key);
  const next = (prefix: string) => {
    let n = 1;
    while (taken.has(`${prefix}${n}`)) n++;
    taken.add(`${prefix}${n}`);
    return `${prefix}${n}`;
  };
  const moons = (list: readonly MoonChoices[]): MoonChoices[] =>
    list.map((m) => ({
      ...m,
      ...(m.key === undefined ? { key: next(BODY_KEY) } : {}),
      ...(m.moons ? { moons: moons(m.moons) } : {}),
    }));
  const bodies = scene.bodies?.map((b): SceneBody => ({
    ...b,
    ...(b.key === undefined ? { key: next(BODY_KEY) } : {}),
    ...(b.moons ? { moons: moons(b.moons) } : {}),
  }));
  const groups = scene.groups?.map((g): GroupPlacement =>
    g.key === undefined ? { ...g, key: next(PLACEMENT_KEY) } : g,
  );
  // A body's path by its places, as the editor read it (its planet's own moons first), by keys.
  const read = bodies && withLibraryMoons(bodies, library);
  const keyed = (places: string): string | undefined => {
    const [planet, ...rest] = places.split('.').map(Number);
    const body = read?.[planet!];
    if (!body) return undefined;
    const path = [siblingKey(body, planet!)];
    let list = body.moons ?? [];
    for (const i of rest) {
      const moon = list[i];
      if (!moon) return undefined;
      path.push(siblingKey(moon, i));
      list = moon.moons ?? [];
    }
    return path.join('.');
  };
  const sceneVariants = scene.sceneVariants?.map((v): SceneVariant => {
    if (!v.switches || !Object.keys(v.switches).some((k) => PLACES.test(k))) return v;
    const switches = Object.fromEntries(
      Object.entries(v.switches).flatMap(([k, on]) => {
        const key = PLACES.test(k) ? keyed(k) : k;
        return key === undefined ? [] : [[key, on]];
      }),
    );
    return { ...v, switches };
  });
  // A camera placed about a planet by its place: about its key (its planet gone: where it is).
  const placed = <T extends { readonly placement?: CameraPlacement }>(c: T): T => {
    const about: unknown = c.placement?.about;
    if (typeof about !== 'number') return c;
    const key = bodies?.[about] && siblingKey(bodies[about], about);
    const { placement, ...rest } = c;
    return (key ? { ...rest, placement: { ...placement!, about: key } } : rest) as T;
  };
  return {
    ...scene,
    ...(bodies ? { bodies } : {}),
    ...(groups ? { groups } : {}),
    ...(sceneVariants ? { sceneVariants } : {}),
    ...(scene.camera ? { camera: placed(scene.camera) } : {}),
    ...(scene.cameras ? { cameras: scene.cameras.map((c): AddedCamera => placed(c)) } : {}),
  };
}
