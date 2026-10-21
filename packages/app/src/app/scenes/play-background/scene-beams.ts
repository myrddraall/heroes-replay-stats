import { normalized, type Vec3 } from './scene-directions';

/**
 * A light's beam, as the editor shows the light selected (an editing aid, never part of the
 * design): a see-through tube as wide as the body it lights, from the body out the way the light
 * comes from, fading as it goes; one that lights glows in its colour, one that darkens takes its
 * colour away. Planets in front of it hide it.
 */
export interface LightBeam {
  /** The body's middle and radius, in the scene. */
  readonly centre: Vec3;
  readonly radius: number;
  /** The way the light comes from, out of the body, in the scene. */
  readonly from: Vec3;
  /** Its colour, each channel 0 to 1. */
  readonly colour: Vec3;
  readonly darkens: boolean;
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
