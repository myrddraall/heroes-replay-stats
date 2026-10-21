import type { PlayScene, SceneMesh } from './play-scene';
import type { Vec3 } from './scene-directions';
import type { MaterialDepth } from './scene-planets';

/** Where a planet is looked at: its middle, and most of the way to its edges up, down and across. */
const LOOKS: readonly Vec3[] = [
  [0, 0, 0],
  [0, 0, 0.7],
  [0, 0, -0.7],
  [0.7, 0, 0],
  [-0.7, 0, 0],
];

/**
 * Where each of the sky's materials is drawn among the scene's objects unless set, from where the
 * game data puts its mesh against the scene's own planets: looking at each planet (its middle and
 * about its edges), a mesh met only in front of every planet is in front of the objects
 * (`foreground`: the Play screen's horizon energy, which the game draws over its planets); one met
 * only behind their middles is behind them (`background`: the Play screen's star cylinder and its
 * twinkling stars' emitter); one met about them is among them (`scene`). A mesh met nowhere about
 * the planets, or a scene with none, is behind them.
 */
export function skyDepths(scene: PlayScene): Readonly<Record<string, MaterialDepth>> {
  let found = known.get(scene);
  if (!found) known.set(scene, (found = depthsOf(scene)));
  return found;
}

/** Each scene's sky depths, once worked out. */
const known = new WeakMap<PlayScene, Readonly<Record<string, MaterialDepth>>>();

function depthsOf(scene: PlayScene): Readonly<Record<string, MaterialDepth>> {
  const eye = scene.camera.eye;
  const planets = Object.values(scene.meshes)
    .filter((mesh) => mesh.planet)
    .map((mesh) => bounds(mesh));
  const rays = planets.flatMap(({ centre, radius }) =>
    LOOKS.map((o) => direction(eye, add(centre, scale(o, radius)))),
  );
  const nearest = Math.min(...planets.map((p) => distance(eye, p.centre) - p.radius));
  const farthest = Math.max(...planets.map((p) => distance(eye, p.centre)));
  const out: Record<string, MaterialDepth> = {};
  const depthOf = (mesh: SceneMesh): MaterialDepth => {
    const met = rays.flatMap((d) => hits(mesh, eye, d));
    if (met.length && met.every((t) => t < nearest)) return 'foreground';
    if (met.every((t) => t > farthest)) return 'background';
    return 'scene';
  };
  for (const mesh of Object.values(scene.meshes)) {
    if (mesh.planet) continue;
    for (const name of mesh.materials) out[name] = depthOf(mesh);
  }
  for (const system of scene.particles) {
    const emitter = scene.meshes[system.emitter];
    if (emitter) out[system.material] = depthOf(emitter);
  }
  // The sky's overlays' meshes in the game data (the energy round the view), as the sky's own.
  for (const overlay of Object.values(scene.overlays ?? {}))
    for (const part of overlay.parts)
      if (part.shape.kind === 'mesh')
        for (const name of part.materials)
          out[name] = depthOf({ ...part.shape, materials: part.materials });
  return out;
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const distance = (a: Vec3, b: Vec3) => Math.hypot(...sub(a, b));
const direction = (from: Vec3, to: Vec3): Vec3 => scale(sub(to, from), 1 / distance(from, to));

/** A mesh's middle and how far it reaches from it (half its box's longest side). */
function bounds(mesh: SceneMesh): { centre: Vec3; radius: number } {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i += 3)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k]!, mesh.positions[i + k]!);
      hi[k] = Math.max(hi[k]!, mesh.positions[i + k]!);
    }
  const centre: Vec3 = [(lo[0]! + hi[0]!) / 2, (lo[1]! + hi[1]!) / 2, (lo[2]! + hi[2]!) / 2];
  return { centre, radius: Math.max(hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!) / 2 };
}

/** How far along a ray from `eye` (unit `d`) it meets the mesh's triangles, each time it does. */
function hits(mesh: SceneMesh, eye: Vec3, d: Vec3): number[] {
  const p = (i: number): Vec3 => [
    mesh.positions[i * 3]!,
    mesh.positions[i * 3 + 1]!,
    mesh.positions[i * 3 + 2]!,
  ];
  const out: number[] = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = p(mesh.indices[i]!);
    const e1 = sub(p(mesh.indices[i + 1]!), a);
    const e2 = sub(p(mesh.indices[i + 2]!), a);
    const h = cross(d, e2);
    const det = dot(e1, h);
    if (Math.abs(det) < 1e-9) continue;
    const s = sub(eye, a);
    const u = dot(s, h) / det;
    if (u < 0 || u > 1) continue;
    const q = cross(s, e1);
    const v = dot(d, q) / det;
    if (v < 0 || u + v > 1) continue;
    const t = dot(e2, q) / det;
    if (t > 0) out.push(t);
  }
  return out;
}
