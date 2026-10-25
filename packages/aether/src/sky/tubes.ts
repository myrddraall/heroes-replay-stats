import type { SceneMesh } from '../formats/play-scene';
import type { Vec3 } from '../space/directions';

/**
 * A sky mesh that is an upright tube (the game's star cylinder: a many-sided one about the eye),
 * as the exact tube it stands for, so it is drawn round rather than faceted: its axis (up) through
 * `centre`, its `radius`, and its texture as the mesh has it, u round the axis (`u`: per turn from
 * +x towards +y, and where it starts) and v up it (`v`: per unit of height, and at height 0).
 */
export interface Tube {
  readonly centre: Vec3;
  readonly radius: number;
  /** Its ends' heights (z), low and high. */
  readonly low: number;
  readonly high: number;
  readonly u: readonly [number, number];
  readonly v: readonly [number, number];
}

/** How far a mesh's points may be from the tube fitted to them, and its texture from the fitted one, and still be it. */
const TOLERANCE = 0.01;

/** The middle value of some numbers. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * The tube a mesh is (see `Tube`), where it is one: its points on a circle about an upright axis
 * (fitted by least squares), each within TOLERANCE of its radius, and its texture straight round
 * and straight up it, each point's within TOLERANCE of the fitted one (a seam's points a turn
 * apart). None: not a tube (a funnel, a band, anything else), drawn as its mesh.
 */
export function fitTube(mesh: SceneMesh): Tube | null {
  const n = Math.floor(mesh.positions.length / 3);
  if (n < 8 || mesh.uvs.length < n * 2) return null;
  const at = (i: number) => [
    mesh.positions[i * 3]!,
    mesh.positions[i * 3 + 1]!,
    mesh.positions[i * 3 + 2]!,
  ];
  // The circle in x and y: x² + y² + Dx + Ey + F = 0 by least squares (its normal equations).
  let sxx = 0,
    sxy = 0,
    syy = 0,
    sx = 0,
    sy = 0,
    sxz = 0,
    syz = 0,
    sz = 0;
  for (let i = 0; i < n; i++) {
    const [x, y] = at(i) as [number, number, number];
    const z = -(x * x + y * y);
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
    sx += x;
    sy += y;
    sxz += x * z;
    syz += y * z;
    sz += z;
  }
  const m = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ];
  const det = (a: number[][]) =>
    a[0]![0]! * (a[1]![1]! * a[2]![2]! - a[1]![2]! * a[2]![1]!) -
    a[0]![1]! * (a[1]![0]! * a[2]![2]! - a[1]![2]! * a[2]![0]!) +
    a[0]![2]! * (a[1]![0]! * a[2]![1]! - a[1]![1]! * a[2]![0]!);
  const d0 = det(m);
  if (Math.abs(d0) < 1e-9) return null;
  const rhs = [sxz, syz, sz];
  const solve = (k: number) =>
    det(m.map((row, r) => row.map((v, c) => (c === k ? rhs[r]! : v)))) / d0;
  const [D, E, F] = [solve(0), solve(1), solve(2)];
  const cx = -D / 2;
  const cy = -E / 2;
  const radius = Math.sqrt(cx * cx + cy * cy - F);
  if (!Number.isFinite(radius) || radius <= 0) return null;
  const turns: number[] = [];
  const heights: number[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y, z] = at(i) as [number, number, number];
    if (Math.abs(Math.hypot(x - cx, y - cy) - radius) > TOLERANCE * radius) return null;
    turns.push(Math.atan2(y - cy, x - cx) / (2 * Math.PI));
    heights.push(z);
  }
  const us = Array.from({ length: n }, (_, i) => mesh.uvs[i * 2]!);
  const vs = Array.from({ length: n }, (_, i) => mesh.uvs[i * 2 + 1]!);
  // u per turn: from neighbouring points round it (not across the seam, where u jumps).
  const slopes: number[] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const dt = turns[j]! - turns[i]!;
      const du = us[j]! - us[i]!;
      if (Math.abs(dt) > 1e-4 && Math.abs(dt) < 0.1 && Math.abs(du) < 0.5) slopes.push(du / dt);
    }
  if (!slopes.length) return null;
  const perTurn = median(slopes);
  const u0 = median(us.map((u, i) => u - perTurn * turns[i]!));
  // v per height: straight up it, by least squares.
  const mh = heights.reduce((a, b) => a + b, 0) / n;
  const mv = vs.reduce((a, b) => a + b, 0) / n;
  const shh = heights.reduce((a, h) => a + (h - mh) * (h - mh), 0);
  if (shh < 1e-9) return null;
  const perHeight = heights.reduce((a, h, i) => a + (h - mh) * (vs[i]! - mv), 0) / shh;
  const v0 = mv - perHeight * mh;
  for (let i = 0; i < n; i++) {
    const off = us[i]! - (perTurn * turns[i]! + u0);
    if (Math.abs(off - Math.round(off)) > TOLERANCE) return null;
    if (Math.abs(vs[i]! - (perHeight * heights[i]! + v0)) > TOLERANCE) return null;
  }
  return {
    centre: [cx, cy, 0],
    radius,
    low: Math.min(...heights),
    high: Math.max(...heights),
    u: [perTurn, u0],
    v: [perHeight, v0],
  };
}

/** How many sides a tube's cover has, and how far past its ends it reaches (of its height). */
const COVER_SIDES = 64;
const COVER_PAST = 0.02;

/**
 * A mesh that covers a tube wherever it is seen, from inside it: many-sided, its sides' middles
 * just outside the tube (so no part of the round tube falls between its corners) and a little past
 * its ends; the shader draws the tube itself where the line from the eye through it meets it, and
 * cuts it off at its ends. Its texture coordinates and colours are unused.
 */
export function tubeCover(tube: Tube): SceneMesh {
  const r = (tube.radius / Math.cos(Math.PI / COVER_SIDES)) * 1.01;
  const past = (tube.high - tube.low) * COVER_PAST;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < COVER_SIDES; i++) {
    const a = (i / COVER_SIDES) * Math.PI * 2;
    const x = tube.centre[0] + r * Math.cos(a);
    const y = tube.centre[1] + r * Math.sin(a);
    positions.push(x, y, tube.low - past, x, y, tube.high + past);
    const [b0, t0, b1, t1] = [
      i * 2,
      i * 2 + 1,
      ((i + 1) % COVER_SIDES) * 2,
      ((i + 1) % COVER_SIDES) * 2 + 1,
    ];
    // Facing in (seen from inside it).
    indices.push(b0, t0, b1, t0, t1, b1);
  }
  const n = positions.length / 3;
  return {
    positions,
    uvs: Array<number>(n * 2).fill(0),
    colors: Array<number>(n * 4).fill(255),
    indices,
    materials: [],
  };
}
