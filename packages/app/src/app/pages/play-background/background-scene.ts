import type { MaterialSettingsMap, MaterialTint } from '../../scenes/play-background/scene-planets';
import { bodyFrame } from '../../scenes/play-background/scene-renderer';

/**
 * The Background page's scene: one planet with its moons (and theirs), under the sky. A moon goes
 * round its parent on an orbit: a circle of a radius about the parent, tilted and turned, the moon
 * a progress of the way round it. What is set here is kept as the page's choices.
 */

export type Vec3 = readonly [number, number, number];

/**
 * A moon's orbit about its parent, in the parent's frame as the eye sees it (x to the right, y
 * away from the eye, z up): a circle in the plane facing up, `radius` parent radii from its
 * centre; tilted about x by `tilt` degrees (its far side up), then turned about the line of sight
 * by `turn` degrees; the moon `progress` of the way round it (0 to the right, 0.25 behind, 0.5 to
 * the left, 0.75 in front), its own radius `size` times its parent's.
 */
export interface Orbit {
  readonly radius: number;
  readonly tilt: number;
  readonly turn: number;
  readonly progress: number;
  readonly size: number;
}

/** A new moon's orbit: in front and to the right, a little tilted, about a quarter its parent's size. */
export const DEFAULT_ORBIT: Orbit = { radius: 2.4, tilt: 12, turn: 0, progress: 0.9, size: 0.27 };

/** A body's settings set on this page, each where set (else its own apply). */
export interface BodySettings {
  readonly lighting?: number;
  readonly shade?: number;
  /** A tint over all its materials. */
  readonly tint?: MaterialTint;
  /** Where its key light comes from, its shade darkens it, and its rims and glows lean (its frame). */
  readonly lightFrom?: Vec3;
  readonly shadeTowards?: Vec3;
  readonly rim?: Vec3;
  /** Its materials' settings, by name (its own and its style's). */
  readonly materials?: MaterialSettingsMap;
}

/** A moon of a body: which planet it is, its orbit, its style and settings, and its own moons. */
export interface MoonChoices {
  readonly id: string;
  readonly orbit: Orbit;
  readonly style?: string;
  readonly settings?: BodySettings;
  readonly moons?: readonly MoonChoices[];
}

/** Where a body is in the scene: the planet ([]), or the moons in turn from it down. */
export type BodyPath = readonly number[];

/** A path as a key: '' for the planet, else its indices joined by dots. */
export const pathKey = (path: BodyPath) => path.join('.');
export const pathOf = (key: string): BodyPath => (key ? key.split('.').map(Number) : []);

/** The moon at a path (none for the planet's path, or one that isn't there). */
export function moonAt(moons: readonly MoonChoices[], path: BodyPath): MoonChoices | undefined {
  let list = moons;
  let moon: MoonChoices | undefined;
  for (const i of path) {
    moon = list[i];
    if (!moon) return undefined;
    list = moon.moons ?? [];
  }
  return moon;
}

/** The moons with the one at `path` changed (null: taken out, with its own moons). */
export function changeMoon(
  moons: readonly MoonChoices[],
  path: BodyPath,
  change: (moon: MoonChoices) => MoonChoices | null,
): readonly MoonChoices[] {
  const [first, ...rest] = path;
  if (first === undefined) return moons;
  const moon = moons[first];
  if (!moon) return moons;
  const changed = rest.length
    ? { ...moon, moons: changeMoon(moon.moons ?? [], rest, change) }
    : change(moon);
  return changed
    ? moons.map((m, i) => (i === first ? changed : m))
    : moons.filter((_, i) => i !== first);
}

/** The moons with a new one about the body at `parent` ([]: the planet). */
export function addMoon(
  moons: readonly MoonChoices[],
  parent: BodyPath,
  moon: MoonChoices,
): readonly MoonChoices[] {
  if (!parent.length) return [...moons, moon];
  return changeMoon(moons, parent, (m) => ({ ...m, moons: [...(m.moons ?? []), moon] }));
}

/** Where a moon is from its parent's centre, in the parent's frame, in the parent's radii. */
export function orbitOffset(orbit: Orbit): Vec3 {
  const a = orbit.progress * 2 * Math.PI;
  const t = (orbit.tilt * Math.PI) / 180;
  const u = (orbit.turn * Math.PI) / 180;
  const x = Math.cos(a) * orbit.radius;
  const y0 = Math.sin(a) * orbit.radius;
  // Tilted about x: the far side of the circle up.
  const y = y0 * Math.cos(t);
  const z = y0 * Math.sin(t);
  // Turned about the line of sight (y): the tilted circle's long axis turned on the screen.
  return [x * Math.cos(u) - z * Math.sin(u), y, x * Math.sin(u) + z * Math.cos(u)];
}

/** A body placed in the scene: where, and how big, in the scene's units. */
export interface PlacedBody {
  readonly path: BodyPath;
  readonly position: Vec3;
  readonly radius: number;
}

/** Progress put in place of a moon's own while it is shown, by its path's key. */
export type ProgressOverrides = ReadonlyMap<string, number>;

/**
 * The scene's bodies placed: the planet where it is put, each moon about its parent by its orbit
 * (its parent's frame turned to face the eye, as the renderer turns it), its moons about it.
 */
export function placeBodies(
  root: { readonly position: Vec3; readonly radius: number },
  moons: readonly MoonChoices[],
  eye: Vec3,
  overrides: ProgressOverrides = new Map(),
): PlacedBody[] {
  const out: PlacedBody[] = [{ path: [], position: root.position, radius: root.radius }];
  const place = (parent: PlacedBody, list: readonly MoonChoices[]) => {
    const { axes } = bodyFrame(parent.position, parent.radius, eye);
    list.forEach((moon, i) => {
      const path = [...parent.path, i];
      const progress = overrides.get(pathKey(path)) ?? moon.orbit.progress;
      const [ox, oy, oz] = orbitOffset({ ...moon.orbit, progress });
      const r = parent.radius;
      const position: Vec3 = [
        parent.position[0] + (axes[0]! * ox + axes[3]! * oy + axes[6]! * oz) * r,
        parent.position[1] + (axes[1]! * ox + axes[4]! * oy + axes[7]! * oz) * r,
        parent.position[2] + (axes[2]! * ox + axes[5]! * oy + axes[8]! * oz) * r,
      ];
      const placed: PlacedBody = { path, position, radius: r * moon.orbit.size };
      out.push(placed);
      place(placed, moon.moons ?? []);
    });
  };
  place(out[0]!, moons);
  return out;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/**
 * Whether a body is hidden from the eye by another nearer one: more than half of it behind it
 * (their centres closer, as the eye sees them, than the nearer one's angular radius and half its own).
 */
export function hidden(body: PlacedBody, bodies: readonly PlacedBody[], eye: Vec3): boolean {
  const to = sub(body.position, eye);
  const d = length(to);
  const own = Math.asin(Math.min(1, body.radius / d));
  return bodies.some((other) => {
    if (other === body) return false;
    const toOther = sub(other.position, eye);
    const e = length(toOther);
    if (e >= d) return false;
    const cos = (to[0] * toOther[0] + to[1] * toOther[1] + to[2] * toOther[2]) / (d * e);
    const apart = Math.acos(Math.max(-1, Math.min(1, cos)));
    return apart < Math.asin(Math.min(1, other.radius / e)) + own * 0.5;
  });
}

/** How finely a hidden moon's orbit is searched for where it shows: steps round it. */
const REVEAL_STEPS = 72;

/**
 * Where the moons on the way to the body at `path` are shown so it can be seen: each moon from the
 * planet down that is hidden is moved round its orbit, the shortest way either way, to where it
 * isn't (to one side of what hid it). Only while it is selected: its own progress is kept.
 */
export function reveal(
  root: { readonly position: Vec3; readonly radius: number },
  moons: readonly MoonChoices[],
  eye: Vec3,
  path: BodyPath,
): ProgressOverrides {
  const overrides = new Map<string, number>();
  for (let depth = 1; depth <= path.length; depth++) {
    const at = path.slice(0, depth);
    const key = pathKey(at);
    const moon = moonAt(moons, at);
    if (!moon) break;
    const shows = (progress: number) => {
      const bodies = placeBodies(root, moons, eye, new Map([...overrides, [key, progress]]));
      const body = bodies.find((b) => pathKey(b.path) === key)!;
      return !hidden(body, bodies, eye);
    };
    const own = moon.orbit.progress;
    if (shows(own)) continue;
    for (let step = 1; step <= REVEAL_STEPS / 2; step++) {
      const found = [own + step / REVEAL_STEPS, own - step / REVEAL_STEPS].find(shows);
      if (found !== undefined) {
        overrides.set(key, ((found % 1) + 1) % 1);
        break;
      }
    }
  }
  return overrides;
}

/** A body's own settings as shown: its own, over its style's, over its file's tuning, over the defaults. */
export interface BodyValues {
  readonly style: string;
  readonly lighting: number;
  readonly shade: number;
  readonly tint: MaterialTint;
  /** Where its key light comes from; none where it has no light. */
  readonly lightFrom: Vec3 | null;
  readonly shadeTowards: Vec3;
  readonly rim: Vec3;
}

/** How far the view reaches either way from its middle: the tangents of its half-angles. */
export interface ViewReach {
  readonly across: number;
  readonly up: number;
}

/** How much of the view's reach the scene may fill, so its outermost moon keeps clear of the edge. */
const FIT_MARGIN = 0.85;

/**
 * The planet's radius that keeps the whole scene in view about it: `root.radius`, or smaller where
 * a moon (with its moons, where they are shown) would reach past the view's edge, the moons' orbits
 * scaling with the planet. As the eye sees it: a body `x` planet radii across from the planet's
 * centre and `y` nearer or further, at radius R, is seen (x + r)·R / (d + y·R) across, which must
 * stay within the view's reach; solved for R body by body, across and up.
 */
export function fitRadius(
  root: { readonly position: Vec3; readonly radius: number },
  moons: readonly MoonChoices[],
  eye: Vec3,
  reach: ViewReach,
  overrides: ProgressOverrides = new Map(),
): number {
  const unit = placeBodies({ position: root.position, radius: 1 }, moons, eye, overrides);
  const { axes } = bodyFrame(root.position, 1, eye);
  const along = (o: Vec3, k: number) => o[0] * axes[k]! + o[1] * axes[k + 1]! + o[2] * axes[k + 2]!;
  const d = length(sub(root.position, eye));
  let radius = root.radius;
  for (const b of unit) {
    const o = sub(b.position, root.position);
    const depth = along(o, 3); // away from the eye
    for (const [side, limit] of [
      [Math.abs(along(o, 0)) + b.radius, FIT_MARGIN * reach.across],
      [Math.abs(along(o, 6)) + b.radius, FIT_MARGIN * reach.up],
    ] as const) {
      const grows = side - limit * depth;
      if (grows > 0) radius = Math.min(radius, (limit * d) / grows);
    }
  }
  return radius;
}

/** A planet's scene as set on the Background page: its style, its settings in each style, its moons. */
export interface PlanetChoices {
  readonly style?: string;
  /** Its settings in each style, by the style's id ('' for none). */
  readonly variants?: Readonly<Record<string, BodySettings>>;
  readonly moons?: readonly MoonChoices[];
}

/** Settings without some of their keys (none left: none at all). */
export function without<T extends object>(
  settings: T | undefined,
  keys: readonly (keyof T)[],
): T | undefined {
  if (!settings) return undefined;
  const next = { ...settings };
  for (const k of keys) delete next[k];
  return Object.keys(next).length ? next : undefined;
}
