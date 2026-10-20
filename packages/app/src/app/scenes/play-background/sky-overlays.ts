import type { SceneCamera, SceneMesh, SkyOverlayFile, SkyPart, SkyShape } from './play-scene';
import type { PartSettings, PartSettingsMap } from './scene-planets';
import { overlayPartKey } from './scene-planets';

/**
 * A sky's overlays: parts about the eye (meshes as the sky's are, or bands), each drawing its
 * materials as the sky's are drawn. A sky has no radius to fit them to: every sky shares the
 * game's camera, so a part is placed by the view, about the eye: made bigger or smaller (further
 * or nearer, the same in view), turned round the eye, and tilted up or down.
 */

type Vec3 = readonly [number, number, number];

/** A band part as it starts: well beyond the planets, low across the middle of the view. */
export const BAND: Extract<SkyShape, { kind: 'band' }> = {
  kind: 'band',
  distance: 90,
  low: -6,
  high: 10,
  from: -60,
  to: 60,
};

/** How many steps round a band's mesh takes (enough that it looks round wherever it is). */
const BAND_STEPS = 64;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** The view's level directions: ahead (forward, level), to the right, and up. */
function levelFrame(camera: SceneCamera): { ahead: Vec3; right: Vec3; up: Vec3 } {
  const up: Vec3 = [0, 0, 1];
  const f = camera.forward;
  const ahead = normalize([f[0], f[1], 0]);
  return { ahead, right: cross(ahead, up), up };
}

/**
 * A band's mesh about the eye: part of an upright cylinder round it, its texture across it from
 * `from` to `to` (u) and down it from `high` to `low` (v), its faces towards the eye.
 */
export function bandMesh(
  band: Extract<SkyShape, { kind: 'band' }>,
  camera: SceneCamera,
): Omit<SceneMesh, 'materials'> {
  const { ahead, right, up } = levelFrame(camera);
  const eye = camera.eye;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const heights = [band.high, band.low].map((h) => band.distance * Math.tan(rad(h)));
  for (let i = 0; i <= BAND_STEPS; i++) {
    const u = i / BAND_STEPS;
    const a = rad(band.from + (band.to - band.from) * u);
    const across = Math.sin(a) * band.distance;
    const along = Math.cos(a) * band.distance;
    heights.forEach((h, row) => {
      for (let k = 0; k < 3; k++)
        positions.push(eye[k]! + ahead[k]! * along + right[k]! * across + up[k]! * h);
      uvs.push(u, row);
      colors.push(255, 255, 255, 255);
    });
  }
  for (let i = 0; i < BAND_STEPS; i++) {
    const [top, bottom, nextTop, nextBottom] = [i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 3];
    indices.push(top, bottom, nextTop, nextTop, bottom, nextBottom);
  }
  // Its faces towards the eye (the renderer draws only those facing it).
  const p = (i: number): Vec3 => [positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!];
  const normal = cross(sub(p(indices[1]!), p(indices[0]!)), sub(p(indices[2]!), p(indices[0]!)));
  if (dot(normal, sub(eye, p(indices[0]!))) < 0)
    for (let i = 0; i < indices.length; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!];
  return { positions, uvs, colors, indices };
}

/** `v` turned about unit `axis` by `degrees` (right-handed). */
function turned(v: Vec3, axis: Vec3, degrees: number): Vec3 {
  if (!degrees) return v;
  const a = rad(degrees);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const d = dot(axis, v) * (1 - c);
  const k = cross(axis, v);
  return [
    v[0] * c + k[0] * s + axis[0] * d,
    v[1] * c + k[1] * s + axis[1] * d,
    v[2] * c + k[2] * s + axis[2] * d,
  ];
}

/**
 * A band as its settings size it about its middle: round the eye `width` times as far either way,
 * up and down `height` times as far (its height in the view: its top's and bottom's angles').
 */
function sized(
  band: Extract<SkyShape, { kind: 'band' }>,
  width = 1,
  height = 1,
): Extract<SkyShape, { kind: 'band' }> {
  if (width === 1 && height === 1) return band;
  const across = (band.from + band.to) / 2;
  const half = ((band.to - band.from) / 2) * width;
  const t = (degrees: number) => Math.tan((degrees * Math.PI) / 180);
  const level = (t(band.low) + t(band.high)) / 2;
  const tall = ((t(band.high) - t(band.low)) / 2) * height;
  const angle = (tangent: number) => (Math.atan(tangent) * 180) / Math.PI;
  return {
    ...band,
    from: across - half,
    to: across + half,
    low: angle(level - tall),
    high: angle(level + tall),
  };
}

/**
 * A sky part's mesh as its settings place it about the eye: its own (a mesh's, or a band's made,
 * `width` times as wide and `height` times as high), `size` times as far from the eye, turned round
 * it by `turn` degrees (to the right) and tilted by `tilt` degrees (up).
 */
export function placedSkyMesh(
  shape: SkyShape,
  settings: PartSettings | undefined,
  camera: SceneCamera,
): Omit<SceneMesh, 'materials'> {
  const own =
    shape.kind === 'band'
      ? bandMesh(sized(shape, settings?.width, settings?.height), camera)
      : shape;
  const { size = 1, turn = 0, tilt = 0 } = settings ?? {};
  if (size === 1 && !turn && !tilt) return own;
  const { right, up } = levelFrame(camera);
  const eye = camera.eye;
  const positions: number[] = [];
  for (let i = 0; i < own.positions.length; i += 3) {
    const v: Vec3 = sub([own.positions[i]!, own.positions[i + 1]!, own.positions[i + 2]!], eye);
    const moved = turned(turned(v, up, -turn), right, tilt);
    for (let k = 0; k < 3; k++) positions.push(eye[k]! + moved[k]! * size);
  }
  return { ...own, positions };
}

/** A sky overlay's part ready to draw: its mesh as placed, the materials on it, its key. */
export interface PlacedSkyPart {
  readonly key: string;
  readonly mesh: Omit<SceneMesh, 'materials'>;
  readonly materials: readonly string[];
}

/** The parts of the overlays a sky wears, as their settings place them (those switched off left out). */
export function skyOverlayParts(
  worn: readonly { readonly id: string; readonly file: SkyOverlayFile }[],
  parts: PartSettingsMap | undefined,
  camera: SceneCamera,
): PlacedSkyPart[] {
  return worn.flatMap(({ id, file }) =>
    file.parts.flatMap((part: SkyPart) => {
      const key = overlayPartKey(id, { id: part.id, role: 'band' });
      const settings = parts?.[key];
      if (settings?.enabled === false) return [];
      return [
        { key, mesh: placedSkyMesh(part.shape, settings, camera), materials: part.materials },
      ];
    }),
  );
}
