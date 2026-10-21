import type { MaterialSettingsMap, MaterialTint, PartSettingsMap } from './scene-planets';
import type { AddedLight, LightSettingsMap } from './scene-lights';
import type { AddedPart } from './created-overlays';
import type { SceneCameraSet } from './play-scene';
import { bodyFrame } from './scene-renderer';

/**
 * The Background page's scene: its planets, each with its moons (and theirs), under the sky. A
 * moon goes round its parent on an orbit: a circle of a radius about the parent, tilted and
 * turned, the moon a progress of the way round it. What is set here is kept as the page's choices.
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
  /** Its name as shown, in place of its id (a style's: the overlay's, wherever it is worn). */
  readonly label?: string;
  /** Whether it is drawn, its moons with it (a scene's). */
  readonly enabled?: boolean;
  /**
   * Whether the overlays it wears are drawn: off, it is drawn as if it wore none of them (what it
   * wears kept). Kept before bodies wore several; each one's own switch is `overlaysEnabled`.
   */
  readonly overlayEnabled?: boolean;
  /** Whether each overlay it wears is drawn, by the overlay's id (off: as if it didn't wear it, kept). */
  readonly overlaysEnabled?: Readonly<Record<string, boolean>>;
  /**
   * Its rig made stronger and turned together (`lighting`, `lightFrom`): kept from before lights
   * were objects, folded into its lights as they start (`tunedRig`), no longer set.
   */
  readonly lighting?: number;
  readonly shade?: number;
  /** A tint over all its materials. */
  readonly tint?: MaterialTint;
  /**
   * How much room its glow is given past its spheres where the view is fitted to it, times their
   * reach (`HALO_MARGIN` unless set).
   */
  readonly glowMargin?: number;
  /** (See `lighting`.) Where its shade darkens it and its rims and glows lean (its frame). */
  readonly lightFrom?: Vec3;
  readonly shadeTowards?: Vec3;
  readonly rim?: Vec3;
  /** Its materials' settings: its own by name, its overlays' by `materialKey` (the overlay's and the name). */
  readonly materials?: MaterialSettingsMap;
  /** Its parts' settings, by part (its own and its style's). */
  readonly parts?: PartSettingsMap;
  /** Its lights' settings, by light (its rig's and its shadow, and any added under it). */
  readonly lights?: LightSettingsMap;
  /** Lights added to it (an overlay's: to the bodies wearing it). */
  readonly added?: readonly AddedLight[];
  /** Its materials' draw order, by `materialKey` (the later over the earlier; see `drawOrder`), where set. */
  readonly order?: readonly string[];
  /**
   * Parts added onto it at this level (its own, as its data's are: keyed `own:<id>`, their
   * materials by name), after those added under it.
   */
  readonly addedParts?: readonly AddedPart[];
}

/**
 * What a scene sets for one of its planet's own moons (the library's), over the planet's: its
 * orbit's values, the overlays it wears, its settings (switched off among them: `enabled`).
 */
export interface MoonOverride {
  readonly orbit?: Partial<Orbit>;
  readonly overlays?: readonly string[];
  readonly settings?: BodySettings;
}

/** A moon of a body: which planet it is, its orbit, what it wears and its settings, and its own moons. */
export interface MoonChoices {
  readonly id: string;
  readonly orbit: Orbit;
  /** Its key among its planet's own moons (the library's): what a scene sets for it is kept by it. */
  readonly key?: string;
  /**
   * Of a scene's body as read (`withLibraryMoons`): that it is one of its planet's own, by its
   * key (nested: the keys joined by `/`). Never kept: a scene keeps what it sets for it
   * (`moonsSet`), the planet keeps the moon.
   */
  readonly inherited?: string;
  /** The overlays it wears, the later over the earlier (none given: its own; see `chosenOverlays`). */
  readonly overlays?: readonly string[];
  /** The one overlay it wore, kept before bodies wore several ('' none). */
  readonly style?: string;
  readonly settings?: BodySettings;
  readonly moons?: readonly MoonChoices[];
}

/** Where a body is: in a scene, its planet's index then its moons' in turn; among moons, theirs alone. */
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

/**
 * The orbit that puts a moon where a body is, about a parent where it is (as `placeBodies` places
 * a moon, untilted on the screen: its turn 0), its size the two's radii's ratio: the tilt within a
 * quarter turn either way, its far side up or down as the body is above or below the parent's
 * middle, the body behind or in front of it as it is.
 */
export function orbitTo(
  parent: { readonly position: Vec3; readonly radius: number },
  body: { readonly position: Vec3; readonly radius: number },
  eye: Vec3,
): Orbit {
  const { axes } = bodyFrame(parent.position, parent.radius, eye);
  const d = sub(body.position, parent.position);
  const [x, y, z] = [0, 3, 6].map(
    (k) => (axes[k]! * d[0] + axes[k + 1]! * d[1] + axes[k + 2]! * d[2]) / parent.radius,
  ) as [number, number, number];
  // y0 sin a round the circle (before the tilt): its sign the body's side, nearer or further.
  const side = y < 0 ? -1 : 1;
  const y0 = side * Math.hypot(y, z);
  const tilt = (Math.atan2(side * z, side * y) * 180) / Math.PI;
  const progress = Math.atan2(y0, x) / (2 * Math.PI);
  return {
    radius: Math.hypot(x, y, z),
    tilt,
    turn: 0,
    progress: ((progress % 1) + 1) % 1,
    size: body.radius / parent.radius,
  };
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
  readonly overlays: readonly string[];
  readonly lighting: number;
  readonly shade: number;
  readonly tint: MaterialTint;
  /** Where its key light comes from; none where it has no light. */
  readonly lightFrom: Vec3 | null;
  readonly shadeTowards: Vec3;
  readonly rim: Vec3;
  readonly glowMargin: number;
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
 * stay within the view's reach; solved for R body by body, across and up. A body's `extent` (in
 * its radii: its shells and halo past its surface, 1 by default) is what must stay in view.
 */
export function fitRadius(
  root: { readonly position: Vec3; readonly radius: number },
  moons: readonly MoonChoices[],
  eye: Vec3,
  reach: ViewReach,
  overrides: ProgressOverrides = new Map(),
  extent: (path: BodyPath) => number = () => 1,
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
      [Math.abs(along(o, 0)) + b.radius * extent(b.path), FIT_MARGIN * reach.across],
      [Math.abs(along(o, 6)) + b.radius * extent(b.path), FIT_MARGIN * reach.up],
    ] as const) {
      const grows = side - limit * depth;
      if (grows > 0) radius = Math.min(radius, (limit * d) / grows);
    }
  }
  return radius;
}

/**
 * A scene of several planets drawn smaller about the middle of the view, where any would reach
 * past its edge: each body's offset across and up from the line of sight, and its radius, times
 * one scale (its distance kept), so the picture keeps its layout, only smaller. As the eye sees
 * a body `x` across at depth `z`, radius `r` (its `extent` in radii what must stay in view), it
 * reaches (|x| + r·extent) / z, which must stay within the view's reach.
 */
export function fitScene<T extends { readonly position: Vec3; readonly radius: number }>(
  bodies: readonly T[],
  extents: readonly number[],
  camera: { readonly eye: Vec3; readonly forward: Vec3; readonly up: Vec3 },
  reach: ViewReach,
): T[] {
  const norm = (v: Vec3): Vec3 => {
    const l = length(v);
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const f = norm(camera.forward);
  // Up made square to the line of sight; right across both.
  const u0 = camera.up;
  const u = norm([u0[0] - f[0] * dot(u0, f), u0[1] - f[1] * dot(u0, f), u0[2] - f[2] * dot(u0, f)]);
  const r: Vec3 = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
  const frames = bodies.map((b) => {
    const v = sub(b.position, camera.eye);
    return { x: dot(v, r), y: dot(v, u), z: dot(v, f) };
  });
  let scale = 1;
  bodies.forEach((b, i) => {
    const { x, y, z } = frames[i]!;
    if (z <= 0) return;
    const size = b.radius * (extents[i] ?? 1);
    for (const [side, limit] of [
      [(Math.abs(x) + size) / z, FIT_MARGIN * reach.across],
      [(Math.abs(y) + size) / z, FIT_MARGIN * reach.up],
    ] as const)
      if (side > limit) scale = Math.min(scale, limit / side);
  });
  if (scale >= 1) return [...bodies];
  return bodies.map((b, i) => {
    const { x, y, z } = frames[i]!;
    const at = (k: 0 | 1 | 2) => camera.eye[k] + f[k] * z + r[k] * x * scale + u[k] * y * scale;
    return { ...b, position: [at(0), at(1), at(2)] as Vec3, radius: b.radius * scale };
  });
}

/**
 * A sky as set on the Background page (a scene's, or the library's): its materials' settings by key
 * (`materialKey`: its overlays' too), a tint over all of it, and the overlays it wears.
 */
export interface SkyChoices {
  readonly materials?: MaterialSettingsMap;
  readonly tint?: MaterialTint;
  /** Its materials' draw order, by `materialKey` (the later over the earlier; see `drawOrder`), where set. */
  readonly order?: readonly string[];
  /** The overlays it wears, the later over the earlier (none given: what is under it; the data's). */
  readonly overlays?: readonly string[];
  /** Whether each overlay it wears is drawn, by id (off: as if it didn't wear it, kept). */
  readonly overlaysEnabled?: Readonly<Record<string, boolean>>;
  /** Its overlays' parts' settings, by part (`style:<overlay>:<part>`; its own added: `own:<id>`). */
  readonly parts?: PartSettingsMap;
  /** Parts added onto it at this level (its own: bands, or its overlays' parts reused), after those under it. */
  readonly addedParts?: readonly AddedPart[];
}

/**
 * A scene as set on the Background page (a planet's, or the random sets', under ''): the planet's
 * style, its settings in each style, its moons, and the scene's sky.
 */
/**
 * A planet of a scene: which planet it is, where it is (in the scene's space) and how big, the
 * overlays it wears, its settings for what it wears (by `wornKey`: the overlays' ids joined, '' for
 * none), and its moons.
 */
export interface SceneBody {
  readonly id: string;
  readonly position: Vec3;
  readonly radius: number;
  /** The overlays it wears, the later over the earlier (none given: its own; see `chosenOverlays`). */
  readonly overlays?: readonly string[];
  /** The one overlay it wore, kept before bodies wore several ('' none). */
  readonly style?: string;
  readonly variants?: Readonly<Record<string, BodySettings>>;
  /** Its own moons (the scene's), after its planet's own (the library's). */
  readonly moons?: readonly MoonChoices[];
  /** What it sets for its planet's own moons, by each moon's key (nested: the keys joined by `/`). */
  readonly moonsSet?: Readonly<Record<string, MoonOverride>>;
}

/**
 * A group put in a scene (or in another group): which (its id), where its middle is put (in the
 * scene's space; its middle: where a scene's first planet goes, `SCENE_CENTRE`), how big (times
 * its own), turned about the up through its middle (degrees, to the right), switched on or off, and
 * named where it is.
 */
export interface GroupPlacement {
  readonly group: string;
  readonly position: Vec3;
  readonly size?: number;
  readonly turn?: number;
  readonly enabled?: boolean;
  readonly label?: string;
}

/** The game's camera, by the id a scene's cameras know it by (first among them, always there). */
export const GAME_CAMERA = 'game';

/** A camera added to a scene: its name, where it is, the way it looks, its field of view. */
export interface AddedCamera {
  readonly id: `camera-${string}`;
  readonly name: string;
  readonly eye: Vec3;
  readonly forward: Vec3;
  readonly fovY: number;
}

/** Where a camera added to a scene puts the view (its place, its way of looking, its field of view). */
export const cameraSetOf = (c: AddedCamera): SceneCameraSet => ({
  eye: c.eye,
  forward: c.forward,
  fovY: c.fovY,
});

/**
 * The camera a scene is shown through, over the game's: its primary (one added to it), else the
 * game's as it puts it.
 */
export function primaryCameraOf(choices: PlanetChoices | undefined): SceneCameraSet | undefined {
  const id = choices?.primaryCamera;
  const added = id ? choices.cameras?.find((c) => c.id === id) : undefined;
  return added ? cameraSetOf(added) : choices?.camera;
}

/**
 * A scene as set on the Background page: its planets (each with its moons), its name, its sky.
 * Scenes kept before scenes had several planets have one (`planet`, `style`, `variants`, `moons`),
 * read as one planet in the middle of the view (`sceneBodies`); what is set now is `bodies`.
 */
export interface PlanetChoices {
  readonly bodies?: readonly SceneBody[];
  /** The scene's lights, lighting every planet in it (a group's: its own planets alone). */
  readonly lights?: readonly AddedLight[];
  /**
   * Whether it is a group: planets (with their moons and lights) to put in scenes, as a scene
   * within a scene; kept with the scenes, listed apart, with no sky of its own.
   */
  readonly group?: boolean;
  /** The groups put in it, in order. */
  readonly groups?: readonly GroupPlacement[];
  /** Where it puts the game's camera, over the data's (each where set): where it is, where it looks, its field of view. */
  readonly camera?: SceneCameraSet;
  /** Cameras added to it (a scene's; not a group's), in order. */
  readonly cameras?: readonly AddedCamera[];
  /** The camera it is shown through, by id: one added (none: the game's). */
  readonly primaryCamera?: string;
  /** What the scene is called, where it is named (else its first planet's id, or its own). */
  readonly name?: string;
  readonly sky?: SkyChoices;
  /** Kept before scenes had several planets: the one planet, its style, looks and moons. */
  readonly planet?: string;
  readonly style?: string;
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
