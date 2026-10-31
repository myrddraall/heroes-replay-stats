import { type Vec3, normalized } from './vectors';

/**
 * How something placed about a body (a light, a moon, a camera about a planet) is set: three ways
 * of working out the same place, about the body's middle, in its frame (x across, y away from the
 * eye, z up) and in its radii.
 *
 * - `free`: the place itself, across, towards the eye and up.
 * - `over`: a spot on the body's sphere and how far out from its middle, along the line through it.
 * - `orbit`: a circle about the middle (`OrbitPlace`), so far round it.
 *
 * Each is only a way of setting the place: switching between them keeps the thing where it is.
 */
export type PlacementMode = 'free' | 'over' | 'orbit';

/**
 * A place on an orbit: a circle in the plane facing up, `radius` radii from the middle; tilted
 * about x by `tilt` degrees (its far side up), then turned about the line of sight by `turn`
 * degrees; `progress` of the way round it (0 to the right, 0.25 behind, 0.5 to the left, 0.75 in
 * front).
 */
export interface OrbitPlace {
  readonly radius: number;
  readonly tilt: number;
  readonly turn: number;
  readonly progress: number;
}

/** A spot on the body's sphere (a unit direction from its middle) and how far out along it, in its radii. */
export interface OverPlace {
  readonly at: Vec3;
  readonly distance: number;
}

const rad = Math.PI / 180;

/** Where a place on an orbit is from the middle. */
export function orbitOffset(orbit: OrbitPlace): Vec3 {
  const a = orbit.progress * 2 * Math.PI;
  const t = orbit.tilt * rad;
  const u = orbit.turn * rad;
  const x = Math.cos(a) * orbit.radius;
  const y0 = Math.sin(a) * orbit.radius;
  // Tilted about x: the far side of the circle up.
  const y = y0 * Math.cos(t);
  const z = y0 * Math.sin(t);
  // Turned about the line of sight (y): the tilted circle's long axis turned on the screen.
  return [x * Math.cos(u) - z * Math.sin(u), y, x * Math.sin(u) + z * Math.cos(u)];
}

/**
 * The orbit turned by `turn` that passes through a place: the same place, its tilt within a
 * quarter turn either way (its far side up or down as the place is above or below the middle),
 * the place behind or in front as it is. At the middle itself: the circle's start, at no radius.
 */
export function orbitThrough(position: Vec3, turn: number): OrbitPlace {
  const u = turn * rad;
  const [px, y, pz] = position;
  // Turned back about the line of sight: the circle's own frame, before its turn.
  const x = px * Math.cos(u) + pz * Math.sin(u);
  const z = -px * Math.sin(u) + pz * Math.cos(u);
  const side = y < 0 ? -1 : 1;
  const y0 = side * Math.hypot(y, z);
  const radius = Math.hypot(px, y, pz);
  if (!radius) return { radius: 0, tilt: 0, turn, progress: 0 };
  const tilt = Math.atan2(side * z, side * y) / rad || 0;
  const progress = Math.atan2(y0, x) / (2 * Math.PI);
  return { radius, tilt, turn, progress: ((progress % 1) + 1) % 1 };
}

/** A place as a spot on the sphere and a distance out (at the middle itself: the spot facing the eye, at none). */
export function overOf(position: Vec3): OverPlace {
  const distance = Math.hypot(...position);
  return { at: distance ? normalized(position) : [0, -1, 0], distance };
}

/** The place a spot and a distance out put it. */
export const overOffset = (over: OverPlace): Vec3 => {
  const at = normalized(over.at);
  return [at[0] * over.distance, at[1] * over.distance, at[2] * over.distance];
};

/**
 * A place no nearer the middle than `least` radii: as it is where it is far enough; else the
 * nearest place that is (out along its own line; at the middle itself, towards the eye).
 */
export function atLeast(position: Vec3, least: number): Vec3 {
  const d = Math.hypot(...position);
  if (d >= least) return position;
  return overOffset({ ...overOf(position), distance: least });
}
