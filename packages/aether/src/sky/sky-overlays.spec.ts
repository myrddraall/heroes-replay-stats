import { describe, expect, it } from 'vitest';
import type { SceneCamera } from '../formats/play-scene';
import { BAND, bandMesh, placedSkyMesh, skyOverlayParts } from './sky-overlays';

const camera: SceneCamera = {
  eye: [0, -40, 5],
  forward: [0, 1, 0],
  up: [0, 0, 1],
  fovY: 43,
  near: 0.4,
  far: 185,
};

/** A mesh's points, as [x, y, z] each. */
const points = (positions: readonly number[]) =>
  Array.from({ length: positions.length / 3 }, (_, i) => positions.slice(i * 3, i * 3 + 3));

describe('sky overlays', () => {
  it("makes a band about the eye: as far as it says, across the view's middle, its faces towards the eye", () => {
    const mesh = bandMesh(BAND, camera);
    for (const [x, y] of points(mesh.positions))
      expect(Math.hypot(x!, y! + 40)).toBeCloseTo(BAND.distance);
    // Its first column at `from` degrees round (to the left), its last at `to` (to the right).
    const [first] = points(mesh.positions);
    const last = points(mesh.positions).at(-1)!;
    expect(first![0]).toBeLessThan(0);
    expect(last[0]).toBeGreaterThan(0);
    // Its first triangle faces the eye.
    const p = (i: number) => points(mesh.positions)[mesh.indices[i]!]!;
    const [a, b, c] = [p(0), p(1), p(2)];
    const e1 = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
    const e2 = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
    const n = [
      e1[1]! * e2[2]! - e1[2]! * e2[1]!,
      e1[2]! * e2[0]! - e1[0]! * e2[2]!,
      e1[0]! * e2[1]! - e1[1]! * e2[0]!,
    ];
    const toEye = [camera.eye[0] - a[0]!, camera.eye[1] - a[1]!, camera.eye[2] - a[2]!];
    expect(n[0]! * toEye[0]! + n[1]! * toEye[1]! + n[2]! * toEye[2]!).toBeGreaterThan(0);
  });

  it('places a part about the eye: further, turned to the right, tilted up', () => {
    const mesh = {
      kind: 'mesh' as const,
      positions: [0, 60, 5],
      uvs: [0, 0],
      colors: [255, 255, 255, 255],
      indices: [],
    };
    const [p] = points(placedSkyMesh(mesh, { size: 2, turn: 90 }, camera).positions);
    expect(p![0]).toBeCloseTo(200); // 100 ahead, turned a quarter to the right, twice as far
    expect(p![1]).toBeCloseTo(-40);
    const [up] = points(placedSkyMesh(mesh, { tilt: 90 }, camera).positions);
    expect(up![2]).toBeCloseTo(105);
  });

  it("draws a worn overlay's parts but those switched off, a band as wide as set", () => {
    const file = {
      parts: [
        { id: 'band-1', shape: BAND, materials: ['a'] },
        { id: 'band-2', shape: BAND, materials: ['b'] },
      ],
      materials: {},
      textures: {},
    };
    const parts = skyOverlayParts(
      [{ id: '@overlay-1', file }],
      { 'style:@overlay-1:band-2': { enabled: false }, 'style:@overlay-1:band-1': { width: 0.5 } },
      camera,
    );
    expect(parts.map((p) => p.key)).toEqual(['style:@overlay-1:band-1']);
    const xs = points(parts[0]!.mesh.positions).map((q) => q[0]!);
    const full = points(bandMesh(BAND, camera).positions).map((q) => q[0]!);
    expect(Math.max(...xs)).toBeLessThan(Math.max(...full));
  });

  it('makes a band taller or shorter about its middle', () => {
    const zs = (height: number) =>
      points(placedSkyMesh(BAND, { height }, camera).positions).map((q) => q[2]!);
    const span = (h: number) => Math.max(...zs(h)) - Math.min(...zs(h));
    expect(span(2)).toBeCloseTo(span(1) * 2);
    // About its middle: the middle stays where it is.
    const middle = (h: number) => (Math.max(...zs(h)) + Math.min(...zs(h))) / 2;
    expect(middle(2)).toBeCloseTo(middle(1));
  });
});
