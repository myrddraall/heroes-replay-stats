import type { LibraryState } from '../library/library';
import { ownScene } from './scenes';
import {
  addMoon,
  type BodyPath,
  changeMoon,
  DEFAULT_ORBIT,
  moonAt,
  type MoonChoices,
  type Orbit,
  orbitTo,
  type PlanetChoices,
  type SceneBody,
  without,
} from './scene-settings';
import type { Viewpoint } from '../space/space';
import type { PlanetSet } from '../planet-sets/planet-sets';
import type { Vec3 } from '../space/vectors';
import { withLibraryMoons } from './scene-moons';
import type { BodySettings } from '../bodies/body-settings';

/**
 * A scene's planets and what is done to them on the Background page: a body is found by its path
 * (its planet's index, then its moons' in turn), and each change gives the planets anew.
 */

/** Where a scene's first planet goes: in the middle of the view, filling much of it. */
export const SCENE_CENTRE: { readonly position: Vec3; readonly radius: number } = {
  position: [0, 65, 4],
  radius: 18,
};

/** The ids new scenes are given (`scene-<n>`): unlike scenes kept by a planet's id, they name no planet. */
const NEW_SCENE = /^scene-\d+$/;

/**
 * The Play screen's planets, from the game's set (`playSet`'s): each where the game puts it, its
 * small one a moon of its medium one, on the orbit that puts it there as the game's camera
 * (`layoutView`, the scene's own) places it.
 */
export function playScreenBodies(set: PlanetSet, layoutView: Viewpoint): SceneBody[] {
  const medium = set.find((p) => p.id === 'play-medium');
  const small = set.find((p) => p.id === 'play-small');
  return set
    .filter((p) => !(medium && p === small))
    .map((p): SceneBody => {
      const body = { id: p.id, position: p.position, radius: p.radius };
      return p === medium && small
        ? { ...body, moons: [{ id: small.id, orbit: orbitTo(medium, small, layoutView) }] }
        : body;
    });
}

/**
 * A scene's planets: its own; or, for a scene kept before scenes had several, its one planet (the
 * one it names, or the one its key is) in the middle of the view; else `defaults` (a preset's).
 * With the library, each planet's own moons among its moons, as the scene sets them
 * (`withLibraryMoons`).
 */
export function sceneBodies(
  choices: PlanetChoices | undefined,
  key: string,
  defaults: readonly SceneBody[] = [],
  library?: LibraryState,
): readonly SceneBody[] {
  const bodies = ((): readonly SceneBody[] => {
    if (choices?.bodies) return choices.bodies;
    const legacy =
      choices?.planet ?? (choices && ownScene(key) && !NEW_SCENE.test(key) ? key : undefined);
    if (!legacy) return defaults;
    return [
      {
        id: legacy,
        ...SCENE_CENTRE,
        style: choices?.style,
        variants: choices?.variants,
        moons: choices?.moons,
      },
    ];
  })();
  return library ? withLibraryMoons(bodies, library) : bodies;
}

/** The body at a path: a planet, or one of its moons. */
export function bodyAt(
  bodies: readonly SceneBody[],
  path: BodyPath,
): SceneBody | MoonChoices | undefined {
  const [b, ...rest] = path;
  const body = b === undefined ? undefined : bodies[b];
  return body && rest.length ? moonAt(body.moons ?? [], rest) : body;
}

const tidyMoons = (moons: readonly MoonChoices[]) => (moons.length ? moons : undefined);

/** The planets with the body at `path` changed (null: taken out, with its moons). */
export function changeAt(
  bodies: readonly SceneBody[],
  path: BodyPath,
  planet: (body: SceneBody) => SceneBody | null,
  moon: (moon: MoonChoices) => MoonChoices | null,
): readonly SceneBody[] {
  const [b, ...rest] = path;
  const body = b === undefined ? undefined : bodies[b];
  if (!body) return bodies;
  const changed = rest.length
    ? { ...body, moons: tidyMoons(changeMoon(body.moons ?? [], rest, moon)) }
    : planet(body);
  return changed ? bodies.map((x, i) => (i === b ? changed : x)) : bodies.filter((_, i) => i !== b);
}

/**
 * A scene planet's settings, whatever it wears: its own; one kept before it had one set, those it
 * had for what it wears now (`worn`: their key, see `wornKey`).
 */
export const planetSettingsOf = (p: SceneBody, worn: string): BodySettings | undefined =>
  p.settings ?? p.variants?.[worn];

/** A planet with its settings set (none, or nothing in them: none), those kept before taken off. */
export function settled(p: SceneBody, settings: BodySettings | undefined): SceneBody {
  const rest = without(p, ['settings', 'variants']) ?? p;
  return settings && Object.keys(settings).length ? { ...rest, settings } : rest;
}

/**
 * A body's settings changed (none left: none): a planet's, whatever it wears (`worn`: the key of
 * what it wears, for one kept before it had one set), a moon's its own.
 */
export function changeSettings(
  bodies: readonly SceneBody[],
  path: BodyPath,
  worn: string,
  change: (settings: BodySettings) => BodySettings | undefined,
): readonly SceneBody[] {
  return changeAt(
    bodies,
    path,
    (p) => settled(p, change(planetSettingsOf(p, worn) ?? {})),
    (m) => {
      const changed = change(m.settings ?? {});
      return { ...m, settings: changed && Object.keys(changed).length ? changed : undefined };
    },
  );
}

/** A moon's orbit changed. */
export const setOrbit = (bodies: readonly SceneBody[], path: BodyPath, change: Partial<Orbit>) =>
  changeAt(
    bodies,
    path,
    (p) => p,
    (m) => ({ ...m, orbit: { ...m.orbit, ...change } }),
  );

/** A planet's place and size changed. */
export const setPlace = (
  bodies: readonly SceneBody[],
  path: BodyPath,
  change: { readonly position?: Vec3; readonly radius?: number },
) =>
  changeAt(
    bodies,
    path,
    (p) => ({ ...p, ...change }),
    (m) => m,
  );

/** A moon, by its planet's id, added about a body (a planet, or a moon): the planets, and its path. */
export function addMoonAt(
  bodies: readonly SceneBody[],
  parent: BodyPath,
  id: string,
): { readonly bodies: readonly SceneBody[]; readonly path: BodyPath } {
  const [b, ...rest] = parent;
  const body = b === undefined ? undefined : bodies[b];
  if (!body) return { bodies, path: parent };
  const moons = body.moons ?? [];
  const count = rest.length ? (moonAt(moons, rest)?.moons?.length ?? 0) : moons.length;
  const next = { ...body, moons: addMoon(moons, rest, { id, orbit: DEFAULT_ORBIT }) };
  return { bodies: bodies.map((x, i) => (i === b ? next : x)), path: [...parent, count] };
}

/** A body taken out: a planet with its moons, or a moon with its own. */
export const removeAt = (bodies: readonly SceneBody[], path: BodyPath) =>
  changeAt(
    bodies,
    path,
    () => null,
    () => null,
  );

/**
 * A planet, by id, added to a scene: the first in the middle of the view; the next ones smaller,
 * beside it, to the right then the left in turn (moved and sized where wanted). The planets, and
 * its path.
 */
export function addPlanet(
  bodies: readonly SceneBody[],
  id: string,
): { readonly bodies: readonly SceneBody[]; readonly path: BodyPath } {
  const n = bodies.length;
  const { position, radius } = SCENE_CENTRE;
  const side = n % 2 ? 1 : -1;
  const step = Math.ceil(n / 2);
  const placed: SceneBody = n
    ? {
        id,
        position: [position[0] + side * step * radius * 1.6, position[1], position[2]],
        radius: radius * 0.5,
      }
    : { id, position, radius };
  return { bodies: [...bodies, placed], path: [n] };
}

/** The planets as they are placed, all else they were set taken off (their styles, looks, moons). */
export const placesOnly = (bodies: readonly SceneBody[]): readonly SceneBody[] =>
  bodies.map((b) => ({ id: b.id, position: b.position, radius: b.radius }));
