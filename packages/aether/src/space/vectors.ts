/** A point or a direction in 3D, and the small vector maths every area shares. */

export type Vec3 = readonly [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

export const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** `v` at unit length (a zero vector left as it is). */
export function normalized(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

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
