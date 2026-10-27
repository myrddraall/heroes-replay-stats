import type { LibraryState } from '../library/library';
import {
  type BodyPath,
  moonAt,
  ORBIT_KEYS,
  type MoonChoices,
  type MoonOverride,
  type Orbit,
  placeBodies,
  type SceneBody,
  without,
} from './scene-settings';
import type { Viewpoint } from '../space/space';
import type { SetPlanet } from '../planet-sets/planet-sets';
import { bodyAt, changeAt } from './scene-bodies';

/** A library moon's key among its planet's: as given, else its index. */
const moonKeyOf = (m: MoonChoices, i: number) => m.key ?? String(i);

/** One of a planet's own moons (the library's) by its key (nested: the keys joined by `/`). */
export function libraryMoonAt(
  own: readonly MoonChoices[] | undefined,
  key: string,
): MoonChoices | undefined {
  let list = own ?? [];
  let moon: MoonChoices | undefined;
  for (const k of key.split('/')) {
    moon = list.find((m, i) => moonKeyOf(m, i) === k);
    if (!moon) return undefined;
    list = moon.moons ?? [];
  }
  return moon;
}

/**
 * A planet's own moons (the library's) as a scene's body reads them: each marked as inherited by
 * its key (nested under its own: the keys joined by `/`), what the scene sets for it over it.
 */
export function inheritedMoons(
  own: readonly MoonChoices[] | undefined,
  set: Readonly<Record<string, MoonOverride>> | undefined,
  prefix = '',
): MoonChoices[] {
  return (own ?? []).map((m, i) => {
    const key = prefix + moonKeyOf(m, i);
    const over = set?.[key];
    const overlays = over?.overlays ?? m.overlays;
    return {
      id: m.id,
      inherited: key,
      orbit: { ...m.orbit, ...over?.orbit },
      ...(overlays ? { overlays } : {}),
      ...(over?.settings ? { settings: over.settings } : {}),
      ...(m.moons?.length ? { moons: inheritedMoons(m.moons, set, `${key}/`) } : {}),
    };
  });
}

/**
 * A scene's bodies as read: each planet's own moons (the library's) first among its moons, as the
 * scene sets them, then the scene's own.
 */
export function withLibraryMoons(
  bodies: readonly SceneBody[],
  library: LibraryState,
): readonly SceneBody[] {
  return bodies.map((b) => {
    const own = library.moons?.[b.id];
    if (!own?.length) return b;
    return { ...b, moons: [...inheritedMoons(own, b.moonsSet), ...(b.moons ?? [])] };
  });
}

const sameList = (a: readonly string[] | undefined, b: readonly string[] | undefined) =>
  a?.length === b?.length && (a ?? []).every((v, i) => v === b?.[i]);

/** The orbit's values that differ from a base's (none: none). */
function orbitOver(orbit: Orbit, base: Orbit): Partial<Orbit> | undefined {
  const out: { -readonly [K in keyof Orbit]?: Orbit[K] } = {};
  for (const k of ORBIT_KEYS) if (orbit[k] !== base[k]) Object.assign(out, { [k]: orbit[k] });
  return Object.keys(out).length ? out : undefined;
}

/** Moons as read (`inheritedMoons` among them) as they are kept: the scene's own, and what it sets for its planet's own, by key. */
function storedMoons(
  read: readonly MoonChoices[],
  own: readonly MoonChoices[],
): { readonly moons: MoonChoices[]; readonly set: Record<string, MoonOverride> } {
  const moons: MoonChoices[] = [];
  const set: Record<string, MoonOverride> = {};
  for (const m of read) {
    if (m.inherited === undefined) {
      moons.push(m);
      continue;
    }
    // Its planet no longer has it: nothing to keep for it.
    const base = libraryMoonAt(own, m.inherited);
    if (!base) continue;
    const orbit = orbitOver(m.orbit, base.orbit);
    const over: MoonOverride = {
      ...(orbit ? { orbit } : {}),
      ...(m.overlays !== undefined && !sameList(m.overlays, base.overlays)
        ? { overlays: m.overlays }
        : {}),
      ...(m.settings && Object.keys(m.settings).length ? { settings: m.settings } : {}),
    };
    if (Object.keys(over).length) set[m.inherited] = over;
    // Its own moons (the library's too; none are the scene's: none can be put about it).
    Object.assign(set, storedMoons(m.moons ?? [], own).set);
  }
  return { moons, set };
}

/**
 * Bodies as read (`withLibraryMoons`) as they are kept: each planet's own moons taken out again,
 * what the scene sets for each (where it differs from the library's) kept by its key.
 */
export function storedBodies(
  bodies: readonly SceneBody[],
  library: LibraryState,
): readonly SceneBody[] {
  return bodies.map((b) => {
    const { moons, set } = storedMoons(b.moons ?? [], library.moons?.[b.id] ?? []);
    const rest = without(b, ['moons', 'moonsSet']) ?? b;
    return {
      ...rest,
      ...(moons.length ? { moons } : {}),
      ...(Object.keys(set).length ? { moonsSet: set } : {}),
    };
  });
}

/** One of a planet's own moons back as the planet has it: nothing the scene set for it kept. */
export function resetMoon(
  bodies: readonly SceneBody[],
  path: BodyPath,
  library: LibraryState,
): readonly SceneBody[] {
  const planet = bodies[path[0] ?? -1];
  const read = planet && bodyAt(bodies, path);
  const base =
    read && 'inherited' in read && read.inherited !== undefined
      ? libraryMoonAt(library.moons?.[planet.id], read.inherited)
      : undefined;
  if (!base) return bodies;
  return changeAt(
    bodies,
    path,
    (p) => p,
    (m) => ({
      id: m.id,
      inherited: m.inherited,
      orbit: base.orbit,
      ...(base.overlays ? { overlays: base.overlays } : {}),
      ...(m.moons ? { moons: m.moons } : {}),
    }),
  );
}

/**
 * A set of planets with each planet's own moons (the library's) placed about it, after it, as
 * the scene places them (`placeBodies`, from `layoutView`: the scene's own camera, whatever the
 * view looks through): drawn where the planet and every body each is a moon of are.
 */
export function setWithMoons(
  set: readonly SetPlanet[],
  library: LibraryState,
  layoutView: Viewpoint,
): SetPlanet[] {
  return set.flatMap((p) => {
    const moons = library.moons?.[p.id] ?? [];
    if (!moons.length) return [p];
    const placed = placeBodies({ position: p.position, radius: p.radius }, moons, layoutView);
    return [
      p,
      ...placed.slice(1).map((at): SetPlanet => {
        const m = moonAt(moons, at.path)!;
        const chain = at.path.map((_, i) => moonAt(moons, at.path.slice(0, i + 1)));
        const drawn = p.enabled !== false && chain.every((b) => b?.settings?.enabled !== false);
        return {
          id: m.id,
          position: at.position,
          radius: at.radius,
          ...(m.overlays ? { overlays: m.overlays } : {}),
          ...(drawn ? {} : { enabled: false }),
        };
      }),
    ];
  });
}

/** The planets' own moons (the library's) a set brings along, each once by its planet (their own among them). */
export function libraryMoonsOf(set: readonly SetPlanet[], library: LibraryState): MoonChoices[] {
  const all = (list: readonly MoonChoices[] | undefined): MoonChoices[] =>
    (list ?? []).flatMap((m) => [m, ...all(m.moons)]);
  return [...new Set(set.map((p) => p.id))].flatMap((id) => all(library.moons?.[id]));
}
