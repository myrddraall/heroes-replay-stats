import type { AddedLight, LightSettingsMap } from './scene-lights';
import {
  shapeReach,
  type BodyPart,
  type BodyShade,
  type LoadedPlanet,
  type MaterialSettingsMap,
  type MaterialTint,
  type PartSettingsMap,
} from './scene-planets';

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

type Vec3 = readonly [number, number, number];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A view matrix (column-major) for an eye looking along `forward`, `up` as near up as it allows. */
export function viewMatrix(eye: Vec3, forward: Vec3, up: Vec3): Float32Array {
  const f = normalize(forward);
  const r = normalize(cross(f, up));
  const u = cross(r, f);
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
  readonly position: Vec3;
  /** Its body's radius in the scene's units. */
  readonly radius: number;
}

/** A body's frame: its axes in the world (column-major: x, y, z), and the eye in it, in units of its radius. */
export interface BodyFrame {
  readonly axes: Float32Array;
  readonly eye: Vec3;
}

/**
 * A planet's body's frame, as the game's billboards turn to face the eye: about its centre, y
 * away from the eye, z as near up as it can be, x to the right; and the eye in that frame, in
 * units of the body's radius.
 */
export function bodyFrame(position: Vec3, radius: number, eye: Vec3): BodyFrame {
  const y = normalize([position[0] - eye[0], position[1] - eye[1], position[2] - eye[2]]);
  const up: Vec3 = Math.abs(y[2]) < 0.999 ? [0, 0, 1] : [0, 1, 0]; // straight above or below: any way up
  const lean = dot(up, y);
  const z = normalize([up[0] - lean * y[0], up[1] - lean * y[1], up[2] - lean * y[2]]);
  const x = cross(y, z);
  const to: Vec3 = [eye[0] - position[0], eye[1] - position[1], eye[2] - position[2]];
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
const ringScale = (shape: { readonly depth: number; readonly seen?: number }, distance: number) =>
  shape.seen ? ringFit(distance, shape.depth) / ringFit(shape.seen, shape.depth) : 1;

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
 * as seen from there.
 */
export function partsExtent(
  radius: number,
  parts: readonly BodyPart[],
  eyeDistance: number,
): number {
  const d = eyeDistance / radius;
  let out = bodyExtent(radius, reach(parts.filter((p) => p.shape.kind !== 'ring')), eyeDistance);
  for (const { shape } of parts) {
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
