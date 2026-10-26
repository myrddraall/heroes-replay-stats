/** Small vector maths the renderer uses. */

export type Vec3 = readonly [number, number, number];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A vector turned about an axis (unit) by an angle in radians. */
export function turnAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = cross(axis, v);
  const d = dot(axis, v) * (1 - c);
  return [
    v[0] * c + k[0] * s + axis[0] * d,
    v[1] * c + k[1] * s + axis[1] * d,
    v[2] * c + k[2] * s + axis[2] * d,
  ];
}

/**
 * How big a flat ring at `depth` (towards the eye, negative) must be to lie on a body's limb seen
 * from `d` (both in the body's radii), but for a factor: the limb's tangent (1 over the root of
 * d² - 1) times the ring's distance from the eye. A ring modelled to lie on the limb from one
 * distance keeps to it from another, scaled by the ratio of the two.
 */
const ringFit = (d: number, depth: number) =>
  Number.isFinite(d) ? (d + depth) / Math.sqrt(Math.max(d * d - 1, 1e-6)) : 1;

/** How much bigger a ring is drawn seen from `d` (the body's radii) than as modelled. */
export const ringScale = (shape: { readonly depth: number; readonly seen?: number }, d: number) =>
  shape.seen ? ringFit(d, shape.depth) / ringFit(shape.seen, shape.depth) : 1;
