import { type LibraryState, ownScene } from './background-design';
import {
  addMoon,
  type BodyPath,
  type GroupPlacement,
  type BodySettings,
  changeMoon,
  DEFAULT_ORBIT,
  moonAt,
  ORBIT_KEYS,
  type MoonChoices,
  type MoonOverride,
  type Orbit,
  orbitTo,
  placeBodies,
  type PlanetChoices,
  type SceneBody,
  type Vec3,
  without,
} from './background-scene';
import {
  type MaterialSettings,
  mergePartSettings,
  ownPartKey,
  overlayPartKey,
  type PartKey,
  type PartSettings,
  type PartSettingsMap,
  type PlanetFile,
  withPart,
  wornParts,
} from './scene-planets';
import { wornKey } from './overlays';
import { reach, type Viewpoint } from './scene-space';
import { compose, pointToWorld, type Transform } from './scene-graph';
import type { AddedLight, LightId, LightSettings } from './scene-lights';
import type { PlanetSet, SetPlanet } from './planet-sets';

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

/** What the ids of groups start with (`group-<n>`): kept with the scenes, they are none. */
export const GROUP_PREFIX = 'group-';
/** Whether a scene's id is a group's. */
export const isGroup = (id: string) => id.startsWith(GROUP_PREFIX);

/** How deep groups are put in groups before the deeper are left out (one put in itself, or round about). */
const GROUP_DEPTH = 6;

/** A group's planet as put in a scene: which placement it comes from (by index, outermost first), and what it is there. */
export interface GroupBody {
  readonly placement: readonly number[];
  /** Its index among its group's own planets. */
  readonly index: number;
  /** The group it is a planet of (its settings are kept there). */
  readonly group: string;
  readonly body: SceneBody;
  /** The lights of the groups it is in (they light their own planets alone). */
  readonly lights: readonly AddedLight[];
}

/**
 * A group's transform in what it is put in: its middle (`SCENE_CENTRE` in its own space) put at the
 * placement's position, turned about the up through it (to the right seen from the eye), sized.
 * What is in a group is placed relative to its middle (`inGroup`).
 */
export function groupTransform(placement: GroupPlacement): Transform {
  const a = ((placement.turn ?? 0) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { position: placement.position, rotation: [c, -s, 0, s, c, 0, 0, 0, 1], scale: placement.size ?? 1 };
}

/** A place in a group's own space, relative to its middle (the local position its group's transform takes). */
const inGroup = (p: Vec3): Vec3 => {
  const centre = SCENE_CENTRE.position;
  return [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]];
};

/**
 * The planets of the groups put in a scene (or a group), where they are put: each group's own, and
 * those of the groups put in it, in turn; those switched off left out. `groups` finds a group by
 * its id. One put in itself (or round about) stops where it would go round again. Each group
 * hangs from what it is put in (`parent`: the world transform of the group it is in; none: the scene), each planet from its group; a
 * group's turn moves where its planets are, not the way they face (each faces as its placement
 * frame has it, wherever it ends up).
 */
export function groupBodies(
  placements: readonly GroupPlacement[] | undefined,
  groups: (id: string) => PlanetChoices | undefined,
  within: readonly string[] = [],
  parent?: Transform,
): GroupBody[] {
  if (within.length >= GROUP_DEPTH) return [];
  return (placements ?? []).flatMap((placement, i) => {
    const group = groups(placement.group);
    if (!group || placement.enabled === false || within.includes(placement.group)) return [];
    const lights = group.lights ?? [];
    // Put in the scene, its transform is its world one (the scene's places are the world's); put
    // in a group, its place is relative to that group's middle.
    const local = groupTransform(placement);
    const world = parent ? compose(parent, { ...local, position: inGroup(local.position) }) : local;
    const own = (group.bodies ?? []).map((body, index): GroupBody => ({
      placement: [i],
      index,
      group: placement.group,
      body: { ...body, position: pointToWorld(world, inGroup(body.position)), radius: body.radius * world.scale },
      lights,
    }));
    const inner = groupBodies(group.groups, groups, [...within, placement.group], world).map(
      (g): GroupBody => ({
        ...g,
        placement: [i, ...g.placement],
        lights: [...g.lights, ...lights],
      }),
    );
    return [...own, ...inner];
  });
}

/** Whether a group may be put in another (`into`): not itself, nor one it is in, round about. */
export function canPutGroup(
  group: string,
  into: string,
  groups: (id: string) => PlanetChoices | undefined,
): boolean {
  if (group === into) return false;
  const holds = (id: string, seen: readonly string[]): boolean =>
    !seen.includes(id) &&
    (groups(id)?.groups ?? []).some((p) => p.group === into || holds(p.group, [...seen, id]));
  return !holds(group, []);
}

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
 * A planet with the overlays it wears changed (none given: back to its own), its settings for what
 * it wears now starting as those for what it wore (`from`: their key) where none are kept for it,
 * so what was set on it stays.
 */
function wearing(p: SceneBody, overlays: readonly string[] | undefined, now: string): SceneBody {
  const rest = without(p, ['style', 'overlays']) ?? p;
  const kept = p.variants?.[now];
  const key = overlays ? wornKey(overlays) : undefined;
  const variants =
    key !== undefined && kept && !p.variants?.[key] ? { ...p.variants, [key]: kept } : p.variants;
  return { ...rest, ...(overlays ? { overlays } : {}), ...(variants ? { variants } : {}) };
}

/** A moon with the overlays it wears changed (none given: back to its own). */
function moonWearing(m: MoonChoices, overlays: readonly string[] | undefined): MoonChoices {
  const rest = without(m, ['style', 'overlays']) ?? m;
  return { ...rest, ...(overlays ? { overlays } : {}) };
}

/**
 * The overlays a body wears chosen (the later over the earlier; [] none), over its own; its
 * settings for what it wore (by `from`, their key) kept for what it wears now.
 */
export const setOverlays = (
  bodies: readonly SceneBody[],
  path: BodyPath,
  overlays: readonly string[],
  from: string,
) =>
  changeAt(
    bodies,
    path,
    (p) => wearing(p, overlays, from),
    (m) => moonWearing(m, overlays),
  );

/** What a body wears back as its own (its settings for it kept, as `setOverlays` keeps them). */
export const resetOverlays = (
  bodies: readonly SceneBody[],
  path: BodyPath,
  from: string,
  own: readonly string[],
) =>
  changeAt(
    bodies,
    path,
    (p) => wearing(wearing(p, own, from), undefined, from),
    (m) => moonWearing(m, undefined),
  );

/** A body's settings changed: a planet's for what it wears (`worn`: its key), a moon's its own (none left: none). */
export function changeSettings(
  bodies: readonly SceneBody[],
  path: BodyPath,
  worn: string,
  change: (settings: BodySettings) => BodySettings | undefined,
): readonly SceneBody[] {
  return changeAt(
    bodies,
    path,
    (p) => {
      const variants = { ...p.variants };
      const changed = change(variants[worn] ?? {});
      if (changed && Object.keys(changed).length) variants[worn] = changed;
      else delete variants[worn];
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

/** Settings with one part's changed (its others, and the other parts', kept). */
export function withPartSetting(
  s: BodySettings,
  key: PartKey,
  change: Partial<PartSettings>,
): BodySettings {
  return { ...s, parts: { ...s.parts, [key]: { ...s.parts?.[key], ...change } } };
}

/** Settings with one part's taken back (all of it: `keys` left out); none left: none at all. */
export function withoutPartSetting(
  s: BodySettings,
  key: PartKey,
  keys?: readonly (keyof PartSettings)[],
): BodySettings | undefined {
  const parts: Partial<Record<PartKey, PartSettings>> = { ...s.parts };
  const left = keys ? without(parts[key], keys) : undefined;
  if (left) parts[key] = left;
  else delete parts[key];
  return without({ ...s, parts }, Object.keys(parts).length ? [] : ['parts']);
}

/**
 * How much of the view a body takes, in its radii: its parts as set (`set`); its spheres (its
 * own, its atmosphere's shells, its overlays' as it wears them) and past them the bloom their glow spreads into; and its rings
 * (its overlays', its own for them where it has any), sized as seen from afar (their biggest), a
 * glow at the limb of their own (the bloom isn't added past them again).
 */
export const HALO_MARGIN = 1.12;
export function visualExtent(
  file?: PlanetFile,
  overlays: readonly { readonly id: string; readonly file?: PlanetFile }[] = [],
  set?: PartSettingsMap,
  /** The room its glow is given past its spheres (times their reach). */
  margin = HALO_MARGIN,
): number {
  const parts = [
    ...(file?.parts ?? []).map((p) => withPart(p, set?.[ownPartKey(p)])),
    ...overlays.flatMap((o) =>
      (o.file ? wornParts(file, o.id, o.file.parts) : []).map((p) =>
        withPart(p, set?.[overlayPartKey(o.id, p)]),
      ),
    ),
  ];
  // Its spheres, tubes, cones and discs with room for their glow; its rings as they lie.
  const solids = parts.filter((p) => p.shape.kind !== 'ring');
  const rings = parts.filter((p) => p.shape.kind === 'ring');
  return Math.max(margin * reach(solids), reach(rings, Infinity));
}

/** A body's parts' settings in effect: under the level edited (its own defaults, its overlays'), then that level's. */
export const bodyParts = (b: {
  readonly below?: { readonly parts?: PartSettingsMap };
  readonly overlays: readonly { readonly below?: { readonly parts?: PartSettingsMap } }[];
  readonly settings: { readonly parts?: PartSettingsMap };
}): PartSettingsMap =>
  mergePartSettings(b.below?.parts, ...b.overlays.map((o) => o.below?.parts), b.settings.parts);

/**
 * A body's shadow as set before its lights were objects (`shade`, `shadeTowards`), as its shadow
 * light's settings.
 */
export function legacyShadow(s: BodySettings): LightSettings {
  return {
    ...(s.shade !== undefined ? { strength: s.shade } : {}),
    ...(s.shadeTowards !== undefined ? { from: s.shadeTowards } : {}),
  };
}

/**
 * Settings with one light's changed (its others, and the other lights', kept); the shadow's taking
 * in what was set for it before lights were objects.
 */
export function withLightSetting(
  s: BodySettings,
  id: LightId,
  change: Partial<LightSettings>,
): BodySettings {
  const shadow = id === 'shadow';
  const rest = shadow ? (without(s, ['shade', 'shadeTowards']) ?? {}) : s;
  const before = { ...(shadow ? legacyShadow(s) : {}), ...s.lights?.[id] };
  return { ...rest, lights: { ...s.lights, [id]: { ...before, ...change } } };
}

/** Settings with one light's taken back (all of it: `keys` left out); none left: none at all. */
export function withoutLightSetting(
  s: BodySettings,
  id: LightId,
  keys?: readonly (keyof LightSettings)[],
): BodySettings | undefined {
  const shadow = id === 'shadow';
  const before = { ...(shadow ? legacyShadow(s) : {}), ...s.lights?.[id] };
  const rest = shadow ? (without(s, ['shade', 'shadeTowards']) ?? {}) : s;
  const lights: Partial<Record<LightId, LightSettings>> = { ...rest.lights };
  const left = keys ? without(before, keys) : undefined;
  if (left) lights[id] = left;
  else delete lights[id];
  return without({ ...rest, lights }, Object.keys(lights).length ? [] : ['lights']);
}

/** A light added to the body's settings (after any added before). */
export function withAddedLight(s: BodySettings, light: AddedLight): BodySettings {
  return { ...s, added: [...(s.added ?? []), light] };
}

/**
 * Settings with a light changed: one added at this level, itself (its settings are its own);
 * any other (its rig's, or one added under this level), what is set for it here.
 */
export function withLightChange(
  s: BodySettings,
  id: LightId,
  change: Partial<LightSettings>,
): BodySettings {
  if (s.added?.some((l) => l.id === id)) return { ...s, added: changedLight(s.added, id, change) };
  return withLightSetting(s, id, change);
}

/**
 * Settings with a light switched on or off: one added at this level, itself (on: as it starts, so
 * not kept); any other, back to what is under this level (`below`) where that is the same (not set
 * here), else set here.
 */
export function withLightSwitched(
  s: BodySettings,
  id: LightId,
  on: boolean,
  below: boolean,
): BodySettings | undefined {
  if (s.added?.some((l) => l.id === id)) return withLightChange(s, id, { enabled: on });
  return on === below
    ? withoutLightSetting(s, id, ['enabled'])
    : withLightSetting(s, id, { enabled: on });
}

/**
 * Settings with a material switched on or off: back to what is under this level (`below`) where
 * that is the same (not set here), else set here.
 */
export function withMaterialSwitched(
  s: BodySettings,
  name: string,
  on: boolean,
  below: boolean,
): BodySettings | undefined {
  return on === below
    ? withoutMaterial(s, name, ['enabled'])
    : withMaterial(s, name, { enabled: on });
}

/**
 * Settings with an overlay the body wears switched on or off: back to what is under this level
 * (`below`) where that is the same (not set here), else set here.
 */
export function withOverlaySwitched(
  s: BodySettings,
  id: string,
  on: boolean,
  below: boolean,
): BodySettings | undefined {
  const enabled = { ...s.overlaysEnabled };
  if (on === below && s.overlayEnabled === undefined) delete enabled[id];
  else enabled[id] = on;
  return without(
    { ...s, overlaysEnabled: enabled },
    Object.keys(enabled).length ? [] : ['overlaysEnabled'],
  );
}

/** Settings with an added light taken out, and what was set for it; none left: none at all. */
export function withoutAddedLight(s: BodySettings, id: LightId): BodySettings | undefined {
  const added = (s.added ?? []).filter((l) => l.id !== id);
  const lights: Partial<Record<LightId, LightSettings>> = { ...s.lights };
  delete lights[id];
  return without({ ...s, added, lights }, [
    ...(added.length ? [] : (['added'] as const)),
    ...(Object.keys(lights).length ? [] : (['lights'] as const)),
  ]);
}

/** Lights with one of them changed (switched on: as an added light starts, so not kept). */
export function changedLight(
  lights: readonly AddedLight[],
  id: LightId,
  change: Partial<LightSettings>,
): AddedLight[] {
  return lights.map((l) => {
    if (l.id !== id) return l;
    const next = { ...l, ...change };
    return next.enabled === true ? (without(next, ['enabled']) ?? next) : next;
  });
}
