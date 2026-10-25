import { normalized, type Vec3 } from './scene-directions';
import type { Orientation } from './scene-graph';

/**
 * A light's beam, as the editor shows a directional light selected (an editing aid, never part
 * of the design): a see-through tube as wide as the body it lights, from the body out the way the
 * light comes from, fading as it goes; one that lights glows in its colour, one that darkens
 * takes its colour away. Planets in front of it hide it.
 */
export interface LightBeam {
  readonly shape: 'beam';
  /** The body's middle and radius, in the scene. */
  readonly centre: Vec3;
  readonly radius: number;
  /** The way the light comes from, out of the body, in the scene. */
  readonly from: Vec3;
  /** Its colour, each channel 0 to 1. */
  readonly colour: Vec3;
  readonly darkens: boolean;
}

/**
 * The outline of where a light falls on its body's sphere, as the editor shows the light
 * selected: for one from a side, a point or a hemisphere the line where it stops reaching (its
 * terminator, or the hemisphere's divide); for a spot the edge of its cone on the body, and,
 * fainter, where its fade starts; for a point, fainter, the ring at its Reach; for the sky round
 * the body, the ring where it starts to take. Drawn in the light's colour (one that darkens:
 * white), where the sphere shows.
 */
export interface LightOutline {
  readonly shape: 'outline';
  /** The body's middle and radius, in the scene. */
  readonly centre: Vec3;
  readonly radius: number;
  /**
   * The body's placement frame (what its lights are set in): its axes in the scene, column by
   * column (x across, y away from the scene's own camera, z up).
   */
  readonly axes: Float32Array;
  /** The light's kind as the shaders number it (0 from a side, 1 a point, 2 a spot, 3 a hemisphere, 4 the sky round the body). */
  readonly kind: number;
  /** The way it travels (from a side), or the way its sky is from (a hemisphere): the body's frame. */
  readonly direction: Vec3;
  /** Where a point or a spot is, in the body's frame and radii, and the way a spot points. */
  readonly position: Vec3;
  readonly aim: Vec3;
  /** A point's reach; a spot's cone (its half-angle, degrees) and how much of it fades. */
  readonly fade: number;
  readonly cone: number;
  readonly edge: number;
  readonly colour: Vec3;
  readonly darkens: boolean;
}

/** What the editor shows of the light selected over the picture: its beam, the outline of where it falls. */
export type LightAid = LightBeam | LightOutline;

/**
 * A planet's axis, as the editor shows the planet selected (an editing aid, never part of the
 * design): a line through its poles, `reach` of its radii out from its middle both ways (the
 * sphere hides what is inside it or behind it), `pixels` thick on the screen, as strong all
 * along, its north half (from the middle to its north end) in one colour, its south half in
 * another; drawn as a light's beam is.
 */
export interface AxisLine {
  readonly shape: 'axis';
  /** The body's middle and radius, in the scene. */
  readonly centre: Vec3;
  readonly radius: number;
  /** Its north pole's way out of the body (its Axis), in the scene (unit). */
  readonly way: Vec3;
  readonly reach: number;
  readonly pixels: number;
  /** Its halves' colours, each channel 0 to 1, and how strongly it shows. */
  readonly north: Vec3;
  readonly south: Vec3;
  readonly strength: number;
  /** The frame its Axis is in: its body's placement frame (`world`), or its frame facing the eye (`camera`). */
  readonly orientation: Orientation;
}

/** How far past an axis's ends its poles' names are (its radii). */
export const AXIS_NAMES_PAST = 0.12;

/** Where an axis's ends are, in the scene: its north one (the way it points) and its south one. */
export function axisEnds(line: AxisLine, past = 0): { readonly north: Vec3; readonly south: Vec3 } {
  const at = (sign: number) =>
    line.centre.map((c, k) => c + sign * line.way[k]! * (line.reach + past) * line.radius) as unknown as Vec3;
  return { north: at(1), south: at(-1) };
}

/** What the editor shows over the picture: a light's aids, a planet's axis. */
export type EditingAid = LightAid | AxisLine;

/** How far a square facing the eye reaches from a body's middle, in its radii, to cover its sphere's outline from any distance the editor looks from. */
export const OUTLINE_EXTENT = 1.15;

/**
 * A spot's cone seen from `eye`: its two edges as seen (the cone's generators the line of sight
 * grazes), each from its apex `at` to where it meets the unit sphere about the origin (or, past
 * the sphere, to its nearest point to it). All in a body's frame, in its radii; `cone` the cone's
 * half-angle in degrees. None where the eye is inside the cone (its edges would be all round).
 */
export function coneEdges(
  at: Vec3,
  aim: Vec3,
  cone: number,
  eye: Vec3,
): readonly (readonly [Vec3, Vec3])[] {
  const a = normalized(aim);
  const [u, v] = beamAcross(a);
  const w: Vec3 = [eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]];
  const dot = (p: Vec3, q: Vec3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const rad = (cone * Math.PI) / 180;
  const alpha = Math.cos(rad) * dot(u, w);
  const beta = Math.cos(rad) * dot(v, w);
  const gamma = Math.sin(rad) * dot(a, w);
  const r = Math.hypot(alpha, beta);
  if (r <= Math.abs(gamma) + 1e-9) return [];
  const middle = Math.atan2(beta, alpha);
  const half = Math.acos(gamma / r);
  return [middle - half, middle + half].map((phi) => {
    const g: Vec3 = [0, 1, 2].map(
      (k) =>
        Math.cos(rad) * a[k]! + Math.sin(rad) * (u[k]! * Math.cos(phi) + v[k]! * Math.sin(phi)),
    ) as unknown as Vec3;
    const t = alongToSphere(at, g);
    return [at, [at[0] + g[0] * t, at[1] + g[1] * t, at[2] + g[2] * t]] as const;
  });
}

/**
 * How far along a ray from `at` the way `g` (unit) the unit sphere about the origin is met; past
 * it, how far to the ray's nearest point to the sphere (at least a little way).
 */
export function alongToSphere(at: Vec3, g: Vec3): number {
  const b = at[0] * g[0] + at[1] * g[1] + at[2] * g[2];
  const c = at[0] * at[0] + at[1] * at[1] + at[2] * at[2] - 1;
  const disc = b * b - c;
  if (disc > 0 && -b - Math.sqrt(disc) > 0) return -b - Math.sqrt(disc);
  return Math.max(-b, 0.5);
}

/** How far out of its body a beam reaches, in the body's radii. */
export const BEAM_LENGTH = 3;

/** How many sides a beam's tube has. */
const SIDES = 32;

/**
 * A beam's tube, before it is put where its beam is: for each corner of its triangles, where it
 * is round the tube (its cosine and sine) and how far along it (0: the body's middle, 1: the far
 * end).
 */
export function beamTube(sides = SIDES): Float32Array {
  const out: number[] = [];
  const at = (i: number, along: number) => {
    const a = (i / sides) * Math.PI * 2;
    out.push(Math.cos(a), Math.sin(a), along);
  };
  for (let i = 0; i < sides; i++) {
    at(i, 0);
    at(i + 1, 0);
    at(i, 1);
    at(i, 1);
    at(i + 1, 0);
    at(i + 1, 1);
  }
  return new Float32Array(out);
}

/** Two ways square to a beam's and to each other: across its tube (any pair will do). */
export function beamAcross(from: Vec3): [Vec3, Vec3] {
  const way = normalized(from);
  // Whichever axis is least along the way, to be square to it.
  const axis: Vec3 = Math.abs(way[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const across = normalized([
    way[1] * axis[2] - way[2] * axis[1],
    way[2] * axis[0] - way[0] * axis[2],
    way[0] * axis[1] - way[1] * axis[0],
  ]);
  const up: Vec3 = [
    way[1] * across[2] - way[2] * across[1],
    way[2] * across[0] - way[0] * across[2],
    way[0] * across[1] - way[1] * across[0],
  ];
  return [across, up];
}
