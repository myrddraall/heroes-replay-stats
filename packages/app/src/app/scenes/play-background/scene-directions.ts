import type { PlanetDirectionalLight, PlanetLight } from './scene-planets';

/**
 * Directions about a planet, in its body's frame (x to the right, y away from the eye, z up), as
 * the Background page's direction controls set them: where its key light comes from (its lights
 * turned together), where its shade darkens it, and where its rims and glows lean.
 */

export type Vec3 = readonly [number, number, number];

/** Straight at the eye: the middle of the planet's face. */
export const TOWARDS_EYE: Vec3 = [0, -1, 0];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function normalized(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** A light's brightness, for which is the key: its colour's luminance. */
const brightness = (l: PlanetDirectionalLight) =>
  0.2126 * l.color[0] + 0.7152 * l.color[1] + 0.0722 * l.color[2];

/** Where a light rig's key (its brightest) light comes from; none for a rig without a lit one. */
export function keyLightFrom(light: PlanetLight | undefined): Vec3 | null {
  const lights = light?.directional.filter((l) => brightness(l) > 0) ?? [];
  if (!lights.length) return null;
  const key = lights.reduce((a, b) => (brightness(b) > brightness(a) ? b : a));
  const d = normalized(key.direction); // the way it travels
  return [-d[0], -d[1], -d[2]];
}

/** `v` turned by the turn that takes unit `from` to unit `to` (the shortest way). */
function turnBy(v: Vec3, from: Vec3, to: Vec3): Vec3 {
  const c = dot(from, to);
  const axis = cross(from, to);
  const s = Math.hypot(axis[0], axis[1], axis[2]);
  if (s < 1e-6) {
    if (c > 0) return v;
    // Half a turn: about any axis square to `from`.
    const any = normalized(
      Math.abs(from[0]) < 0.9 ? cross(from, [1, 0, 0]) : cross(from, [0, 1, 0]),
    );
    const k = 2 * dot(any, v);
    return [k * any[0] - v[0], k * any[1] - v[1], k * any[2] - v[2]];
  }
  const k: Vec3 = [axis[0] / s, axis[1] / s, axis[2] / s];
  const kv = cross(k, v);
  const kd = dot(k, v) * (1 - c);
  return [
    v[0] * c + kv[0] * s + k[0] * kd,
    v[1] * c + kv[1] * s + k[1] * kd,
    v[2] * c + kv[2] * s + k[2] * kd,
  ];
}

/** A light rig turned as a whole so its key light comes from `from` (as it is where it has no key). */
export function lightFrom(light: PlanetLight, from: Vec3): PlanetLight {
  const key = keyLightFrom(light);
  if (!key) return light;
  const to = normalized(from);
  return {
    ...light,
    directional: light.directional.map((l) => ({
      ...l,
      direction: turnBy(normalized(l.direction), key, to),
    })),
  };
}

/**
 * The turn a lean of the rims and glows makes of the view their fresnel is measured against:
 * radians about the view's up (to the right) and about its right (upwards, negative, as the
 * shader turns), so what faces the eye moves to `towards` (a point on the face: its y towards the
 * eye; one on the far side leans as far as the limb).
 */
export function rimTurn(towards: Vec3): readonly [number, number] {
  const [x, , z] = normalized(towards);
  const front = Math.sqrt(Math.max(0, 1 - x * x - z * z));
  return [Math.atan2(x, front), -Math.asin(Math.max(-1, Math.min(1, z)))];
}
