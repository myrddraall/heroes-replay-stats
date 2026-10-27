import type { SceneCamera, SceneCameraSet } from '../formats/play-scene';
import { type Vec3 } from '../space/vectors';

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;
const round = (v: number, places = 3) => Math.round(v * 10 ** places) / 10 ** places;

/** The camera's way of looking as a turn and a tilt, in degrees. */
export function cameraAngles(forward: Vec3): { turn: number; tilt: number } {
  const length = Math.hypot(...forward) || 1;
  const [x, y, z] = forward.map((v) => v / length) as [number, number, number];
  return { turn: round(deg(Math.atan2(x, y)), 2) || 0, tilt: round(deg(Math.asin(z)), 2) || 0 };
}

/** The way a camera turned and tilted so (degrees) looks. */
export function forwardOf(turn: number, tilt: number): Vec3 {
  const t = rad(turn);
  const p = rad(tilt);
  return [Math.sin(t) * Math.cos(p), Math.cos(t) * Math.cos(p), Math.sin(p)];
}

/** How far ahead of the camera, along the way it looks, a point is (at least `least`). */
export function distanceAhead(camera: SceneCamera, point: Vec3, least = 1): number {
  const [fx, fy, fz] = camera.forward;
  const d =
    (point[0] - camera.eye[0]) * fx +
    (point[1] - camera.eye[1]) * fy +
    (point[2] - camera.eye[2]) * fz;
  return Math.max(least, d);
}

const along = (from: Vec3, way: Vec3, by: number): Vec3 => [
  from[0] + way[0] * by,
  from[1] + way[1] * by,
  from[2] + way[2] * by,
];

/** Where a camera is and the way it looks, rounded as kept. */
const kept = (eye: Vec3, forward: Vec3): SceneCameraSet => ({
  eye: eye.map((v) => round(v)) as unknown as Vec3,
  forward: forward.map((v) => round(v, 5)) as unknown as Vec3,
});

/**
 * The camera orbited round the point it looks at `distance` ahead: turned round the up by `turn`
 * degrees and tilted by `tilt` (to the right and up: the camera moving the other way round it).
 */
export function orbit(
  camera: SceneCamera,
  distance: number,
  turn: number,
  tilt: number,
): SceneCameraSet {
  const pivot = along(camera.eye, camera.forward, distance);
  const angles = cameraAngles(camera.forward);
  const forward = forwardOf(angles.turn + turn, Math.max(-89, Math.min(89, angles.tilt + tilt)));
  return kept(along(pivot, forward, -distance), forward);
}

/** A camera's axes looking `forward` (its up the world's): across to the right, up the view, ahead. */
function viewAxes(forward: Vec3): [Vec3, Vec3, Vec3] {
  const l = Math.hypot(...forward) || 1;
  const f: Vec3 = [forward[0] / l, forward[1] / l, forward[2] / l];
  const rl = Math.hypot(f[1], f[0]) || 1;
  const r: Vec3 = [f[1] / rl, -f[0] / rl, 0];
  const u: Vec3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  return [r, u, f];
}

/**
 * The camera orbited round a point (`pivot`, a planet it is about), turned round the up by `turn`
 * degrees and tilted by `tilt` as `orbit` turns it, carried round with its way of looking as one:
 * the point stays where it is in the view, wherever that is (it needn't be the view's middle).
 */
export function orbitAround(
  camera: SceneCamera,
  pivot: Vec3,
  turn: number,
  tilt: number,
): SceneCameraSet {
  const angles = cameraAngles(camera.forward);
  const forward = forwardOf(angles.turn + turn, Math.max(-89, Math.min(89, angles.tilt + tilt)));
  const [r0, u0, f0] = viewAxes(camera.forward);
  const [r1, u1, f1] = viewAxes(forward);
  const d: Vec3 = [camera.eye[0] - pivot[0], camera.eye[1] - pivot[1], camera.eye[2] - pivot[2]];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const [a, b, c] = [dot(d, r0), dot(d, u0), dot(d, f0)];
  const eye = [0, 1, 2].map(
    (k) => pivot[k]! + a * r1[k]! + b * u1[k]! + c * f1[k]!,
  ) as unknown as Vec3;
  return kept(eye, forward);
}

/** The camera moved across the view: `right` and `up` (in the scene's units), the way it looks kept. */
export function pan(camera: SceneCamera, right: number, up: number): SceneCameraSet {
  const f = camera.forward;
  const r: Vec3 = [f[1], -f[0], 0];
  const rl = Math.hypot(...r) || 1;
  const across: Vec3 = [r[0] / rl, r[1] / rl, 0];
  // Up in the view: square to the way it looks and across.
  const u: Vec3 = [
    across[1] * f[2] - across[2] * f[1],
    across[2] * f[0] - across[0] * f[2],
    across[0] * f[1] - across[1] * f[0],
  ];
  const eye = along(along(camera.eye, across, right), u, up);
  return kept(eye, camera.forward);
}

/** The camera moved along the way it looks by `by` (in: positive), no nearer than `least` to what it looks at `distance` ahead. */
export function dolly(
  camera: SceneCamera,
  distance: number,
  by: number,
  least = 2,
): SceneCameraSet {
  const step = Math.min(by, distance - least);
  return kept(along(camera.eye, camera.forward, step), camera.forward);
}

/** A field of view (degrees) kept to what a camera can show. */
export const fieldOfView = (degrees: number) => Math.max(5, Math.min(120, round(degrees, 2)));

/** A camera as it is seen through: where it is, the way it looks, which way is up, its field of view. */
type Lens = Pick<SceneCamera, 'eye' | 'forward' | 'up' | 'fovY'>;

/** A camera's axes: the way it looks, to its right, and up in its view (as the renderer's view has them). */
function axesOf(camera: Lens): { f: Vec3; r: Vec3; u: Vec3 } {
  const unit = (v: Vec3): Vec3 => {
    const l = Math.hypot(...v) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const f = unit(camera.forward);
  const r = unit(cross(f, camera.up));
  return { f, r, u: cross(r, f) };
}

/** A point as a camera sees it: across and up from it, and ahead. */
function inView(camera: Lens, p: Vec3): Vec3 {
  const { f, r, u } = axesOf(camera);
  const v: Vec3 = [p[0] - camera.eye[0], p[1] - camera.eye[1], p[2] - camera.eye[2]];
  const dot = (a: Vec3) => a[0] * v[0] + a[1] * v[1] + a[2] * v[2];
  return [dot(r), dot(u), dot(f)];
}

/** Where a point is in a view: shares of its width and height from its top left, and how far ahead it is. */
export interface ViewPoint {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

/** A point of the camera's own space (across, up, ahead) where it shows in a view `aspect` wide. */
function onView(camera: Lens, aspect: number, [x, y, z]: Vec3): ViewPoint {
  const t = 1 / Math.tan((camera.fovY * Math.PI) / 360);
  return { x: (1 + (t * x) / (aspect * z)) / 2, y: (1 - (t * y) / z) / 2, depth: z };
}

/** The way from a camera's eye through a point of its view (`x`, `y`: shares of its width and height from its top left), `aspect` wide: a unit vector. */
export function viewRay(camera: Lens, aspect: number, x: number, y: number): Vec3 {
  const { f, r, u } = axesOf(camera);
  const t = Math.tan((camera.fovY * Math.PI) / 360);
  const a = (2 * x - 1) * aspect * t;
  const b = (1 - 2 * y) * t;
  const d = [0, 1, 2].map((k) => r[k]! * a + u[k]! * b + f[k]!);
  const l = Math.hypot(...d);
  return d.map((v) => v / l) as unknown as Vec3;
}

/** Where a point shows in a view through a camera, `aspect` wide; none where it is behind it. */
export function viewPoint(camera: Lens, aspect: number, p: Vec3, near = 0.05): ViewPoint | null {
  const c = inView(camera, p);
  return c[2] < near ? null : onView(camera, aspect, c);
}

/**
 * A line between two points as it shows in a view through a camera, `aspect` wide: cut where it
 * passes behind the camera; none where all of it is.
 */
export function viewLine(
  camera: Lens,
  aspect: number,
  a: Vec3,
  b: Vec3,
  near = 0.05,
): readonly [ViewPoint, ViewPoint] | null {
  let ca = inView(camera, a);
  let cb = inView(camera, b);
  if (ca[2] < near && cb[2] < near) return null;
  const cut = (from: Vec3, to: Vec3): Vec3 => {
    const k = (near - from[2]) / (to[2] - from[2]);
    return [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, near];
  };
  if (ca[2] < near) ca = cut(ca, cb);
  else if (cb[2] < near) cb = cut(cb, ca);
  return [onView(camera, aspect, ca), onView(camera, aspect, cb)];
}

/**
 * What a camera sees, outlined `distance` ahead of it in a view `aspect` wide: the lines from it to
 * the corners there, and the edges between them.
 */
export function cameraOutline(
  camera: Lens,
  aspect: number,
  distance: number,
): readonly (readonly [Vec3, Vec3])[] {
  const { f, r, u } = axesOf(camera);
  const up = distance * Math.tan((camera.fovY * Math.PI) / 360);
  const across = up * aspect;
  const corner = (x: number, y: number): Vec3 => [
    camera.eye[0] + f[0] * distance + r[0] * x * across + u[0] * y * up,
    camera.eye[1] + f[1] * distance + r[1] * x * across + u[1] * y * up,
    camera.eye[2] + f[2] * distance + r[2] * x * across + u[2] * y * up,
  ];
  const corners = [corner(-1, 1), corner(1, 1), corner(1, -1), corner(-1, -1)];
  return [
    ...corners.map((c) => [camera.eye, c] as const),
    ...corners.map((c, i) => [c, corners[(i + 1) % 4]!] as const),
  ];
}
