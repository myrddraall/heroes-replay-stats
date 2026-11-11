import { DataTexture, FloatType, NearestFilter, RGBAFormat } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import {
  dot,
  float,
  floor,
  If,
  int,
  ivec2,
  Loop,
  max,
  normalize,
  select,
  textureLoad,
  vec3,
} from 'three/tsl';
import type { Vec3 } from '../../space/vectors';

/**
 * A shell of flat plates, as a part's drawn hex pattern stands for its grid texture: a geodesic
 * sphere. Each face of an icosahedron (one face's middle at the pattern's pole) is cut into a
 * triangular grid `n` to an edge, and each grid point, out on the sphere, is a plate's middle:
 * hexes, and twelve pentagons where the icosahedron's corners were (no closed shell of hexes has
 * none). Where two plates' middles are as near as each other, the two plates meet: an edge. (Flat
 * plates all as far from the middle meet there too: a line along the plates' edges.)
 */

type V3 = Node<'vec3'>;
type F = Node<'float'>;

/**
 * How near two of its grid points' directions are (their dot) for them to be one plate's middle,
 * found in two faces (a point on the edge between them): as near as 32-bit floats make them, far
 * nearer than any two plates' (about 0.995 apart for the game's 60 round).
 */
const SAME_PLATE = 0.9999;

/** How many plates round a shell cut `n` to an icosahedron's edge: its edge's angle into a turn. */
export const PLATES_ROUND_PER_CUT = (2 * Math.PI) / Math.acos(1 / Math.sqrt(5));

/** How many cuts to an icosahedron's edge give a shell about `round` plates round. */
export const platesCut = (round: number) => Math.max(1, Math.round(round / PLATES_ROUND_PER_CUT));

const unit = (v: readonly number[]): Vec3 => {
  const l = Math.hypot(...v);
  return [v[0]! / l, v[1]! / l, v[2]! / l];
};

/** An icosahedron's twenty faces on the unit sphere, each its middle then its three corners; turned so the first's middle is straight up (z). */
export const ICOSAHEDRON_FACES: readonly (readonly [Vec3, Vec3, Vec3, Vec3])[] = (() => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const corners: Vec3[] = [];
  for (const a of [-1, 1])
    for (const b of [-phi, phi])
      corners.push(unit([0, a, b]), unit([a, b, 0]), unit([b, 0, a]));
  const near = (p: Vec3, q: Vec3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2] > 0.4;
  const faces: [Vec3, Vec3, Vec3][] = [];
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let k = j + 1; k < 12; k++)
        if (near(corners[i]!, corners[j]!) && near(corners[j]!, corners[k]!) && near(corners[i]!, corners[k]!))
          faces.push([corners[i]!, corners[j]!, corners[k]!]);
  // Turned (about the axis square to both) so the first face's middle is up.
  const middle = (f: readonly Vec3[]) => unit([0, 1, 2].map((c) => f[0]![c]! + f[1]![c]! + f[2]![c]!));
  const m = middle(faces[0]!);
  const axis = [m[1], -m[0], 0];
  const s = Math.hypot(...axis);
  const c = m[2];
  const k = s > 1e-12 ? axis.map((v) => v / s) : [1, 0, 0];
  const turn = (v: Vec3): Vec3 => {
    const kv = k[0]! * v[0] + k[1]! * v[1] + k[2]! * v[2];
    const x: Vec3 = [k[1]! * v[2] - k[2]! * v[1], k[2]! * v[0] - k[0]! * v[2], k[0]! * v[1] - k[1]! * v[0]];
    return [0, 1, 2].map((i) => v[i]! * c + x[i]! * s + k[i]! * kv * (1 - c)) as unknown as Vec3;
  };
  return faces.map((f) => {
    const turned = f.map(turn) as [Vec3, Vec3, Vec3];
    return [middle(turned), ...turned] as const;
  });
})();

/** The faces as the shader reads them: a row a face, its middle and corners across it. */
const FACES_TEXTURE = (() => {
  const data = new Float32Array(20 * 4 * 4);
  ICOSAHEDRON_FACES.forEach((face, f) =>
    face.forEach((v, r) => data.set([...v, 0], (f * 4 + r) * 4)),
  );
  const texture = new DataTexture(data, 4, 20, RGBAFormat, FloatType);
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
})();

/** The two plates' middles nearest `p` (a unit direction in the pattern's frame), the nearer first: on a shell cut `n` to an edge. */
export function nearestPlates(p: V3, n: F): { readonly near: V3; readonly next: V3 } {
  const row = (f: Node<'int'>, r: number) =>
    (textureLoad(FACES_TEXTURE, ivec2(int(r), f)) as unknown as Node<'vec4'>).xyz;
  // The two faces it is nearest the middles of: the one it is on, and the one over its nearest edge.
  const first = int(0).toVar();
  const second = int(0).toVar();
  const firstDot = float(-2).toVar();
  const secondDot = float(-2).toVar();
  Loop(20, ({ i }) => {
    const d = dot(p, row(i, 0)).toVar();
    If(d.greaterThan(firstDot), () => {
      second.assign(first);
      secondDot.assign(firstDot);
      first.assign(i);
      firstDot.assign(d);
    }).ElseIf(d.greaterThan(secondDot), () => {
      second.assign(i);
      secondDot.assign(d);
    });
  });
  // In each, the grid points round where it falls on the face (out to the next row: those of its
  // two plates); the nearest two, each once (a point on an edge is both faces').
  const near = vec3(0, 0, 1).toVar();
  const next = vec3(0, 0, -1).toVar();
  const nearDot = float(-2).toVar();
  const nextDot = float(-2).toVar();
  Loop(2, ({ i }) => {
    const f = select(i.equal(0), first, second).toVar();
    const middle = row(f, 0).toVar();
    const a = row(f, 1).toVar();
    const across = row(f, 2).sub(a).toVar();
    const up = row(f, 3).sub(a).toVar();
    // On the face's plane, out from its middle, then where on its grid.
    const w = p.mul(dot(a, middle).div(max(dot(p, middle), 1e-4))).sub(a).toVar();
    const d00 = dot(across, across).toVar();
    const d01 = dot(across, up).toVar();
    const d11 = dot(up, up).toVar();
    const d20 = dot(w, across).toVar();
    const d21 = dot(w, up).toVar();
    const det = d00.mul(d11).sub(d01.mul(d01)).toVar();
    const x = d11.mul(d20).sub(d01.mul(d21)).div(det).mul(n).toVar();
    const y = d00.mul(d21).sub(d01.mul(d20)).div(det).mul(n).toVar();
    const x0 = floor(x).sub(1).toVar();
    const y0 = floor(y).sub(1).toVar();
    Loop(16, ({ i: k }) => {
      const kf = float(k).toVar();
      const row4 = floor(kf.div(4)).toVar();
      const gx = x0.add(row4).toVar();
      const gy = y0.add(kf.sub(row4.mul(4))).toVar();
      const on = gx
        .greaterThan(-0.5)
        .and(gy.greaterThan(-0.5))
        .and(gx.add(gy).lessThan(n.add(0.5)))
        .toVar();
      If(on, () => {
        const v = normalize(a.add(across.mul(gx.div(n))).add(up.mul(gy.div(n)))).toVar();
        const d = dot(p, v).toVar();
        const again = dot(v, near).greaterThan(SAME_PLATE).or(dot(v, next).greaterThan(SAME_PLATE));
        If(again.not(), () => {
          If(d.greaterThan(nearDot), () => {
            next.assign(near);
            nextDot.assign(nearDot);
            near.assign(v);
            nearDot.assign(d);
          }).ElseIf(d.greaterThan(nextDot), () => {
            next.assign(v);
            nextDot.assign(d);
          });
        });
      });
    });
  });
  return { near, next };
}

/**
 * How far `p` is from the edge between its two nearest plates (`near`, `next`), in plates (about
 * 0.5 at a plate's middle, 0 on its edge), and the way that grows (per unit `p` moves: for its
 * change across the pixel).
 */
export function plateEdge(p: V3, near: V3, next: V3): { readonly edge: F; readonly grows: V3 } {
  const apart = near.sub(next).toVar();
  const grows = apart.div(max(dot(apart, apart), 1e-12)).toVar();
  return { edge: dot(p, grows).sub(dot(next.add(near).mul(0.5), grows)).toVar(), grows };
}
