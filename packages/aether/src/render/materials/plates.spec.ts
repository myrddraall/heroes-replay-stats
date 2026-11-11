import { describe, expect, it } from 'vitest';
import { ICOSAHEDRON_FACES, platesCut } from './plates';

type V = readonly [number, number, number];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a: V): V => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};
/** A face's grid point (i across, j up of n), out on the sphere. */
const gridPoint = (f: number, i: number, j: number, n: number): V => {
  const [, a, b, c] = ICOSAHEDRON_FACES[f]!;
  return unit([0, 1, 2].map((k) => a[k]! + (b[k]! - a[k]!) * (i / n) + (c[k]! - a[k]!) * (j / n)) as unknown as V);
};

/** Every plate's middle on a shell cut n to an edge, once each. */
function allPlates(n: number): V[] {
  const out: V[] = [];
  for (let f = 0; f < 20; f++)
    for (let i = 0; i <= n; i++)
      for (let j = 0; i + j <= n; j++) {
        const v = gridPoint(f, i, j, n);
        if (!out.some((o) => dot(o, v) > 1 - 1e-9)) out.push(v);
      }
  return out;
}

/** The shader's search (`nearestPlates`), step for step: its two faces, the grid round it in each. */
function searched(p: V, n: number): [V, V] {
  const order = ICOSAHEDRON_FACES.map((face, f) => [dot(p, face[0]), f] as const).sort(
    (x, y) => y[0] - x[0],
  );
  let near: V = [0, 0, 1];
  let next: V = [0, 0, -1];
  let nearDot = -2;
  let nextDot = -2;
  for (const [, f] of order.slice(0, 2)) {
    const [middle, a, b, c] = ICOSAHEDRON_FACES[f]!;
    const across = sub(b, a);
    const up = sub(c, a);
    const scale = dot(a, middle) / Math.max(dot(p, middle), 1e-4);
    const w = sub([p[0] * scale, p[1] * scale, p[2] * scale], a);
    const d00 = dot(across, across);
    const d01 = dot(across, up);
    const d11 = dot(up, up);
    const d20 = dot(w, across);
    const d21 = dot(w, up);
    const det = d00 * d11 - d01 * d01;
    const x = ((d11 * d20 - d01 * d21) / det) * n;
    const y = ((d00 * d21 - d01 * d20) / det) * n;
    for (let k = 0; k < 16; k++) {
      const gx = Math.floor(x) - 1 + Math.floor(k / 4);
      const gy = Math.floor(y) - 1 + (k % 4);
      if (gx < 0 || gy < 0 || gx + gy > n) continue;
      const v = gridPoint(f, gx, gy, n);
      if (dot(v, near) > 0.9999 || dot(v, next) > 0.9999) continue;
      const d = dot(p, v);
      if (d > nearDot) {
        next = near;
        nextDot = nearDot;
        near = v;
        nearDot = d;
      } else if (d > nextDot) {
        next = v;
        nextDot = d;
      }
    }
  }
  return [near, next];
}

describe('a shell of flat plates', () => {
  it('is an icosahedron cut n to an edge: 10n² + 2 plates, its first face’s middle up', () => {
    expect(ICOSAHEDRON_FACES).toHaveLength(20);
    ICOSAHEDRON_FACES[0]![0].forEach((v, k) => expect(v).toBeCloseTo([0, 0, 1][k]!, 12));
    for (const face of ICOSAHEDRON_FACES)
      for (const v of face) expect(Math.hypot(...v)).toBeCloseTo(1, 12);
    expect(allPlates(3)).toHaveLength(92);
    expect(allPlates(11)).toHaveLength(1212);
  });

  it('is cut to as many round as the game’s grid shows (60 round a planet: 11 to an edge)', () => {
    expect(platesCut(60)).toBe(11);
    expect(platesCut(1)).toBe(1);
  });

  it('finds, as the shader does, the two plates any point lies between, as all of them would', () => {
    const n = 11;
    const plates = allPlates(n);
    // A fixed spread of points over the sphere (a spiral: no randomness, the same every run).
    const count = 4000;
    for (let s = 0; s < count; s++) {
      const z = 1 - (2 * (s + 0.5)) / count;
      const r = Math.sqrt(1 - z * z);
      const a = s * Math.PI * (3 - Math.sqrt(5));
      const p: V = [r * Math.cos(a), r * Math.sin(a), z];
      const ranked = plates.map((v) => dot(p, v)).sort((x, y) => y - x);
      const [near, next] = searched(p, n);
      expect(dot(p, near)).toBeCloseTo(ranked[0]!, 9);
      expect(dot(p, next)).toBeCloseTo(ranked[1]!, 9);
    }
  });
});
