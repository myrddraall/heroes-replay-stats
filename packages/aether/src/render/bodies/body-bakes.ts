import { type Vec3 } from '../../space/vectors';

/** A rectangle of the frame in whole pixels, from its bottom left (GL's): x, y, width, height. */
export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** How many pixels a bake reaches past its body's square (each edge is smoothed over a pixel). */
const BAKE_PAD = 2;

/**
 * The pixels of a frame `width` × `height` that a body's square covers: its corners (in the
 * world) through the view-projection, out to whole pixels and a little past, within the frame.
 * A corner behind the eye: the whole frame (it may cover any of it). None: none of it shows.
 */
export function bakeRect(
  corners: readonly Vec3[],
  viewProjection: Float32Array,
  width: number,
  height: number,
): PixelRect | null {
  const m = viewProjection;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [x, y, z] of corners) {
    const w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
    if (w <= 1e-6) return { x: 0, y: 0, w: width, h: height };
    const px = (((m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) / w + 1) / 2) * width;
    const py = (((m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) / w + 1) / 2) * height;
    x0 = Math.min(x0, px);
    y0 = Math.min(y0, py);
    x1 = Math.max(x1, px);
    y1 = Math.max(y1, py);
  }
  const left = Math.max(0, Math.floor(x0) - BAKE_PAD);
  const bottom = Math.max(0, Math.floor(y0) - BAKE_PAD);
  const right = Math.min(width, Math.ceil(x1) + BAKE_PAD);
  const top = Math.min(height, Math.ceil(y1) + BAKE_PAD);
  if (right <= left || top <= bottom) return null;
  return { x: left, y: bottom, w: right - left, h: top - bottom };
}

/**
 * Where a body is in the frame, for reading the sky round it: its centre as shares of the frame's
 * width and height from the bottom left, and how far one radius reaches across and up, as shares
 * too (`right`: the view's right, in the world). Behind the eye: the frame's middle, no reach.
 */
export function frameSpot(
  centre: Vec3,
  radius: number,
  right: Vec3,
  viewProjection: Float32Array,
  width: number,
  height: number,
): [number, number, number, number] {
  const m = viewProjection;
  const share = ([x, y, z]: Vec3): [number, number] | null => {
    const w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
    if (w <= 1e-6) return null;
    return [
      ((m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) / w + 1) / 2,
      ((m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) / w + 1) / 2,
    ];
  };
  const c = share(centre);
  const r = share([
    centre[0] + right[0] * radius,
    centre[1] + right[1] * radius,
    centre[2] + right[2] * radius,
  ]);
  if (!c || !r) return [0.5, 0.5, 0, 0];
  const across = Math.abs(r[0] - c[0]);
  return [c[0], c[1], across, (across * width) / height];
}

/** A bake target's size for a rectangle: rounded up, so a body that grows a little keeps its target. */
export const bakeSize = (n: number) => Math.max(64, Math.ceil(n / 64) * 64);

/**
 * How many pixels a second a body's scrolling layers move across it at most: each layer's scroll
 * (texture units a second, times its tiling) times how many pixels a unit spans (a sphere's u goes
 * round it: the half seen spans its width, so a unit is about twice that).
 */
export function scrollPixels(
  layers: readonly {
    readonly scroll: { readonly by: readonly [number, number]; readonly seconds: number };
    readonly tiling?: readonly [number, number];
  }[],
  rect: PixelRect,
): number {
  const span = 2 * Math.max(rect.w, rect.h);
  let most = 0;
  for (const { scroll, tiling = [1, 1] } of layers) {
    if (scroll.seconds <= 0) continue;
    const u = (scroll.by[0] * tiling[0]) / scroll.seconds;
    const v = (scroll.by[1] * tiling[1]) / scroll.seconds;
    most = Math.max(most, Math.hypot(u, v) * span);
  }
  return most;
}

/** How far (pixels) a baked body's layers may scroll before it is baked again: under a pixel shows no step. */
export const REBAKE_PIXELS = 0.5;
