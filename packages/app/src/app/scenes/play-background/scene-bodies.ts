import { ownScene } from './background-design';
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
  type SceneBody,
  type Vec3,
  without,
} from './background-scene';
import { type MaterialSettings, type PlanetFile, wornParts } from './scene-planets';
import { reach } from './scene-renderer';

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
 * A scene's planets: its own; or, for a scene kept before scenes had several, its one planet (the
 * one it names, or the one its key is) in the middle of the view; else `defaults` (a preset's).
 */
export function sceneBodies(
  choices: PlanetChoices | undefined,
  key: string,
  defaults: readonly SceneBody[] = [],
): readonly SceneBody[] {
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

/** A body's style chosen ('': none, over its own). */
export const setStyle = (bodies: readonly SceneBody[], path: BodyPath, style: string) =>
  changeAt(
    bodies,
    path,
    (p) => ({ ...p, style }),
    (m) => ({ ...m, style }),
  );

/** A body's style back as its own. */
export const resetStyle = (bodies: readonly SceneBody[], path: BodyPath) =>
  changeAt(
    bodies,
    path,
    (p) => ({ ...p, style: undefined }),
    (m) => ({ ...m, style: undefined }),
  );

/** A body's settings changed: a planet's in the style it wears (`style`), a moon's its own (none left: none). */
export function changeSettings(
  bodies: readonly SceneBody[],
  path: BodyPath,
  style: string,
  change: (settings: BodySettings) => BodySettings | undefined,
): readonly SceneBody[] {
  return changeAt(
    bodies,
    path,
    (p) => {
      const variants = { ...p.variants };
      const changed = change(variants[style] ?? {});
      if (changed && Object.keys(changed).length) variants[style] = changed;
      else delete variants[style];
      return { ...p, variants: Object.keys(variants).length ? variants : undefined };
    },
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

/** Settings with one material's changed. */
export function withMaterial(
  s: BodySettings,
  name: string,
  change: Partial<MaterialSettings>,
): BodySettings {
  return { ...s, materials: { ...s.materials, [name]: { ...s.materials?.[name], ...change } } };
}

/** Settings with one material's taken back (all of it: `keys` left out); none left: none at all. */
export function withoutMaterial(
  s: BodySettings,
  name: string,
  keys?: readonly (keyof MaterialSettings)[],
): BodySettings | undefined {
  const materials = { ...s.materials };
  const left = keys ? without(materials[name], keys) : undefined;
  if (left) materials[name] = left;
  else delete materials[name];
  return without({ ...s, materials }, Object.keys(materials).length ? [] : ['materials']);
}

/**
 * How much of the view a body takes, in its radii: its spheres (its own, its atmosphere's shells,
 * its style's as it wears them) and past them the bloom their glow spreads into; and its rings
 * (its style's, its own for them where it has any), sized as seen from afar (their biggest), a
 * glow at the limb of their own (the bloom isn't added past them again).
 */
export const HALO_MARGIN = 1.12;
export function visualExtent(file?: PlanetFile, styleFile?: PlanetFile, style?: string): number {
  const parts = [
    ...(file?.parts ?? []),
    ...(styleFile ? wornParts(file, style, styleFile.parts) : []),
  ];
  const spheres = parts.filter((p) => p.shape.kind === 'sphere');
  const rings = parts.filter((p) => p.shape.kind === 'ring');
  return Math.max(HALO_MARGIN * reach(spheres), reach(rings, Infinity));
}
