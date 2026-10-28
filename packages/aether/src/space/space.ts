import type { AddedLight, LightReach, LightSettingsMap } from '../lights/lights';
import type { Orientation, Quat } from './graph';
import { type PartSettingsMap, shapeReach } from '../formats/part-shapes';
import type { BodyPart, BodyShade } from '../formats/planet-files';
import type { LoadedPlanet } from '../formats/planet-loader';
import type { MaterialSettingsMap, MaterialTint } from '../materials/material-settings';
import { type Vec3, cross, dot, normalized } from './vectors';

/**
 * Where the scene's things are: the camera's matrices, a planet put up in it (its placement), its
 * body's frame and how far the square its parts are drawn on reaches, and the backdrop drawn in
 * place of the sky.
 */

/**
 * An editing aid in place of the sky (none of the sky, its stars or particles drawn): a plain
 * colour, or a grid of two as image editors show transparency, its squares `size` CSS pixels.
 * Colours are 0 to 1, shown as they are.
 */
export type Backdrop =
  | { readonly kind: 'colour'; readonly colour: Vec3 }
  | { readonly kind: 'grid'; readonly size: number; readonly colours: readonly [Vec3, Vec3] };

/**
 * A camera's axes as its view has them: the way it looks, to its right, and up on the screen (its
 * `up` made square to the way it looks). Looking straight along its up (no right to be had), the
 * right is as it is with the camera turned to look along +y (of a z up: x), its view's up the
 * limit it comes to tilted there.
 */
function viewAxes(forward: Vec3, up: Vec3): { f: Vec3; r: Vec3; u: Vec3 } {
  const f = normalized(forward);
  const across = cross(f, up);
  const r = Math.hypot(...across) > 1e-9 ? normalized(across) : normalized(cross([0, 1, 0], up));
  return { f, r, u: cross(r, f) };
}

/** Where things are seen from: the eye, the way it looks and its up (a camera, as `viewMatrix` takes it). */
export interface Viewpoint {
  readonly eye: Vec3;
  readonly forward: Vec3;
  readonly up: Vec3;
}

/**
 * Up on the screen for a camera looking along `forward`, `up` its up (as `viewMatrix` takes them):
 * the view's up, its second row. What a body's frame is turned to (`bodyFrame`): give it this.
 */
export function viewUp({ forward, up }: Pick<Viewpoint, 'forward' | 'up'>): Vec3 {
  return viewAxes(forward, up).u;
}

/** A view matrix (column-major) for an eye looking along `forward`, `up` as near up as it allows. */
export function viewMatrix(eye: Vec3, forward: Vec3, up: Vec3): Float32Array {
  const { f, r, u } = viewAxes(forward, up);
  return new Float32Array([
    r[0],
    u[0],
    -f[0],
    0,
    r[1],
    u[1],
    -f[1],
    0,
    r[2],
    u[2],
    -f[2],
    0,
    -dot(r, eye),
    -dot(u, eye),
    dot(f, eye),
    1,
  ]);
}

/** Two 4×4 matrices (column-major) multiplied: `a` after `b`. */
export function multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) out[c * 4 + r]! += a[k * 4 + r]! * b[c * 4 + k]!;
  return out;
}

/** Where the eye of a view matrix (as `viewMatrix` makes one: a turn and a move) is in the world. */
export function eyeOf(view: Float32Array): Vec3 {
  const t = [view[12]!, view[13]!, view[14]!];
  const at = (c: number) =>
    -(view[c * 4]! * t[0]! + view[c * 4 + 1]! * t[1]! + view[c * 4 + 2]! * t[2]!);
  return [at(0), at(1), at(2)];
}

/**
 * A turn and a move undone (column-major, as `viewMatrix` makes them: no scale): the turn
 * transposed, the move turned back and the other way.
 */
export function rigidInverse(m: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) out[c * 4 + r] = m[r * 4 + c]!;
  const [x, y, z] = eyeOf(m);
  out[12] = x;
  out[13] = y;
  out[14] = z;
  out[15] = 1;
  return out;
}

/**
 * A perspective projection (column-major) with a vertical field of view in degrees; its far plane
 * may be infinitely far (nothing however far is cut off).
 */
export function projectionMatrix(
  fovY: number,
  aspect: number,
  near: number,
  far: number,
): Float32Array {
  const t = 1 / Math.tan((fovY * Math.PI) / 360);
  const infinite = !Number.isFinite(far);
  return new Float32Array([
    t / aspect,
    0,
    0,
    0,
    0,
    t,
    0,
    0,
    0,
    0,
    infinite ? -1 : (far + near) / (near - far),
    -1,
    0,
    0,
    infinite ? -2 * near : (2 * far * near) / (near - far),
    0,
  ]);
}

/** A planet put up in the scene: where, how big, and which tint channel is its. */
export interface PlanetPlacement {
  readonly planet: LoadedPlanet;
  /**
   * The overlays it wears, the later over the earlier: their parts about the body, the first's
   * light (of those that have one) on the body's lit materials.
   */
  readonly overlays?: readonly LoadedPlanet[];
  /** Not drawn (nor picked), though where it is: switched off. */
  readonly hidden?: boolean;
  /** Drawn dimmed (outside what an editor is in), by the renderer's `dim`. */
  readonly dimmed?: boolean;
  /** Drawn dimmed but for what this takes in of its parts and materials (what a light reaches of it). */
  readonly dimmedOutside?: LightReach;
  /**
   * Its materials' settings (its own by name, its overlays' by `materialKey`), over the tunings'
   * (the planet's for its materials, an overlay's for its own).
   */
  readonly materials?: MaterialSettingsMap;
  /** The materials' base settings, by name, under its overlays' materials' own. */
  readonly base?: MaterialSettingsMap;
  /** Its parts' shapes and mappings, by part, in place of their own. */
  readonly parts?: PartSettingsMap;
  /** Its materials' draw order, by `materialKey` (its own and its overlays'), where set (see `drawOrder`). */
  readonly order?: readonly string[];
  /** Its lights' settings, by light, over its rig's and its shade (see `scene-lights.ts`). */
  readonly lights?: LightSettingsMap;
  /** Lights added to it (its own and its overlay's), after its rig's. */
  readonly added?: readonly AddedLight[];
  /** A tint over all its materials (its overlays' too), over its tuning's. */
  readonly tint?: MaterialTint;
  /**
   * Its rig turned and made stronger together (`tunedRig`), over its tuning's: kept from before
   * lights were objects (each light's own settings now), no longer set.
   */
  readonly lightFrom?: Vec3;
  /** Where its rims and glows lean (a point on its face), over its tuning's; none: as the data has them. */
  readonly rim?: Vec3;
  /** (See `lightFrom`.) */
  readonly lighting?: number;
  /** A shade from a side, over its overlays'. */
  readonly shade?: Partial<BodyShade>;
  /** Which way its surfaces are turned, over its tuning's (its parts and materials may set their own). */
  readonly orientation?: Orientation;
  /** Where its poles point (its frame), and its turn about them (degrees), over its tuning's (see `bodyTurn`). */
  readonly axis?: Vec3;
  readonly turn?: number;
  /** Its base turn, over its tuning's (see `bodyTurn`). */
  readonly baseTurn?: Quat;
  readonly position: Vec3;
  /** Its body's radius in the scene's units. */
  readonly radius: number;
}

/** A body's frame: its axes in the world (column-major: x, y, z), and the eye in it, in units of its radius. */
export interface BodyFrame {
  readonly axes: Float32Array;
  readonly eye: Vec3;
}

/** Some unit vector square to a unit one. */
const squareTo = (v: Vec3): Vec3 =>
  normalized(cross(v, Math.abs(v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));

/**
 * A planet's body's frame, as the game's billboards turn to face the eye: about its centre, y
 * away from the eye, z as near the view's up (`viewUp`: up on the screen) as it can be, x to the
 * right; and the eye in that frame, in units of the body's radius. From the camera drawing it,
 * turned with the camera, it is the frame a billboard surface is drawn in (it keeps its way up on
 * the screen however the camera turns or tilts, straight down or up as well: the view's up is
 * square to the way the camera looks, so for anything in view it is never along the way to it).
 * From the scene's own camera it is the body's placement frame (`placementFrame`), fixed in the
 * world, which its moons and lights are placed in. (The eye at the body's centre, there is no way
 * to face: it faces any way square to the view's up.)
 */
export function bodyFrame(position: Vec3, radius: number, eye: Vec3, viewUp: Vec3): BodyFrame {
  const to: Vec3 = [eye[0] - position[0], eye[1] - position[1], eye[2] - position[2]];
  const y =
    Math.hypot(...to) > 1e-9 ? normalized([-to[0], -to[1], -to[2]]) : squareTo(normalized(viewUp));
  const lean = dot(viewUp, y);
  const off: Vec3 = [viewUp[0] - lean * y[0], viewUp[1] - lean * y[1], viewUp[2] - lean * y[2]];
  const z = Math.hypot(...off) > 1e-9 ? normalized(off) : squareTo(y); // straight above or below on the screen: never in view
  const x = cross(y, z);
  return {
    axes: new Float32Array([...x, ...y, ...z]),
    eye: [dot(to, x) / radius, dot(to, y) / radius, dot(to, z) / radius],
  };
}

/**
 * How big a flat ring at `depth` (towards the eye, negative) must be to lie on a body's limb seen
 * from `distance` (both in the body's radii), but for a factor: the limb's tangent (1 over the
 * root of distance² - 1) times the ring's distance from the eye. A ring modelled to lie on the
 * limb from one distance keeps to it from another, scaled by the ratio of the two.
 */
const ringFit = (distance: number, depth: number) =>
  Number.isFinite(distance)
    ? (distance + depth) / Math.sqrt(Math.max(distance * distance - 1, 1e-6))
    : 1; // from afar: the limb as far as the ring

/** How much bigger a ring is drawn seen from `distance` (the body's radii) than as modelled. */
export const ringScale = (
  shape: { readonly depth: number; readonly seen?: number },
  distance: number,
) => (shape.seen ? ringFit(distance, shape.depth) / ringFit(shape.seen, shape.depth) : 1);

/**
 * The half-side of the square a body's parts are drawn on, in the scene's units: as far as they
 * reach, widened for perspective. A sphere seen from a finite distance shows wider than its radius
 * on the plane through its centre (its outline is where the eye's rays graze it, nearer the eye):
 * by d/sqrt(d^2 - r^2) for a sphere of radius r at distance d; a square only as wide as the radius
 * cuts its edges off, the more so the nearer and larger the body.
 */
export function bodyExtent(radius: number, reachOf: number, eyeDistance: number): number {
  const r = radius * reachOf;
  const d = Math.max(eyeDistance, r * 1.01); // the eye inside it: as wide as it can usefully be
  return (r * d) / Math.sqrt(d * d - r * r);
}

/**
 * The half-side of the square a body's parts are drawn on (see `bodyExtent`), from all of them:
 * its spheres widened for perspective, and its rings (flat, facing the eye, `depth` from its
 * centre: one nearer the eye shows wider on the square, by d over its plane's distance), sized
 * as seen from there. A ring fixed in the world (among `standing`: tilted any way as the eye goes
 * round) is taken as the sphere it turns within (as far out as its outer edge, its plane's depth
 * off the centre).
 */
export function partsExtent(
  radius: number,
  parts: readonly BodyPart[],
  eyeDistance: number,
  standing: ReadonlySet<BodyPart> = new Set(),
): number {
  const d = eyeDistance / radius;
  const flat = (p: BodyPart) => p.shape.kind === 'ring' && !standing.has(p);
  const sphereOf = (p: BodyPart) =>
    p.shape.kind === 'ring'
      ? Math.hypot(p.shape.outer * ringScale(p.shape, d), p.shape.depth)
      : shapeReach(p.shape);
  let out = bodyExtent(
    radius,
    Math.max(1, ...parts.filter((p) => !flat(p)).map(sphereOf)),
    eyeDistance,
  );
  for (const { shape } of parts.filter(flat)) {
    if (shape.kind !== 'ring') continue;
    const plane = d + shape.depth;
    if (plane > 0) out = Math.max(out, (radius * shape.outer * ringScale(shape, d) * d) / plane);
  }
  return out;
}

/** How far a body's parts reach from its centre, in its radii (its shells, rings, offset moons): at least 1. */
export function reach(parts: readonly BodyPart[], distance?: number): number {
  return Math.max(
    1,
    ...parts.map((p) =>
      p.shape.kind === 'ring'
        ? p.shape.outer * (distance ? ringScale(p.shape, distance) : 1)
        : shapeReach(p.shape),
    ),
  );
}
