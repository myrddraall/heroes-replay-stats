import { describe, expect, it } from 'vitest';
import { EMPTY_LIBRARY, type LibraryState, skyWithLibrary } from '../library/library';
import { materialValues } from '../materials/material-settings';
import type { SceneMaterial } from '../formats/play-scene';
import { eyeOf, multiplyMatrices, rigidInverse, viewMatrix } from '../space/space';
import {
  anchoredDepth,
  anchoredView,
  DEFAULT_SKY_ANCHOR,
  skyAnchorOf,
  skyTransform,
} from './sky-anchors';

type Vec3 = readonly [number, number, number];

/** A point through a column-major matrix (no divide: these are turns and moves). */
const apply = (m: Float32Array, [x, y, z]: Vec3): Vec3 => {
  const at = (r: number) => m[r]! * x + m[4 + r]! * y + m[8 + r]! * z + m[12 + r]!;
  return [at(0), at(1), at(2)];
};

const expectClose = (a: ArrayLike<number>, b: ArrayLike<number>, digits = 4) => {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) expect(a[i]!).toBeCloseTo(b[i]!, digits);
};

// The scene's own camera (the Play screen's), and others about the scene.
const reference = viewMatrix([0, -41.2, 5.6], [0, 0.9997, -0.025], [0, 0, 1]);
const cameras = [
  viewMatrix([12, -30, 9], [-0.3, 0.9, -0.2], [0, 0, 1]),
  viewMatrix([-25, 4, -3], [0.8, 0.1, 0.3], [0, 0, 1]),
  viewMatrix([0, -41.2, 5.6], [0.5, 0.86, 0], [0, 0, 1]),
  viewMatrix([3, 7, 60], [0, 0.2, -1], [0, 0, 1]),
];
const points: Vec3[] = [
  [0, 0, 0],
  [40, 90, -12],
  [-80, 15, 33],
];

describe('the sky’s anchor, level over level', () => {
  const material: SceneMaterial = {
    diffuse: null,
    emissive: null,
    alphaMasks: [],
    blend: 'add',
  } as unknown as SceneMaterial;

  it('is fixed in the world where nothing sets it', () => {
    expect(DEFAULT_SKY_ANCHOR).toBe('world');
    expect(skyAnchorOf(undefined, undefined)).toBe('world');
    expect(skyAnchorOf(undefined, skyWithLibrary(undefined, EMPTY_LIBRARY).anchor)).toBe('world');
  });

  it('is the scene’s sky’s over the library’s', () => {
    const library: LibraryState = { ...EMPTY_LIBRARY, sky: { anchor: 'position' } };
    expect(skyWithLibrary(undefined, library).anchor).toBe('position');
    expect(skyWithLibrary({ anchor: 'camera' }, library).anchor).toBe('camera');
    expect(skyWithLibrary({ tint: undefined }, library).anchor).toBe('position');
  });

  it('is a material’s own over the sky’s, set at any level (the scene’s over the library’s)', () => {
    const library: LibraryState = {
      ...EMPTY_LIBRARY,
      sky: { anchor: 'camera', materials: { streams: { anchor: 'world' } } },
    };
    const sky = skyWithLibrary({ materials: { nebula: { anchor: 'position' } } }, library);
    expect(skyAnchorOf(sky.materials?.['streams'], sky.anchor)).toBe('world');
    expect(skyAnchorOf(sky.materials?.['nebula'], sky.anchor)).toBe('position');
    expect(skyAnchorOf(sky.materials?.['stars'], sky.anchor)).toBe('camera');
    const scene = skyWithLibrary({ materials: { streams: { anchor: 'camera' } } }, library);
    expect(skyAnchorOf(scene.materials?.['streams'], scene.anchor)).toBe('camera');
  });

  it('shows on a material as its own, else the sky’s; never among the objects where not fixed', () => {
    expect(materialValues(material, undefined).anchor).toBe('world');
    expect(materialValues(material, undefined, 'scene', 'camera').anchor).toBe('camera');
    expect(materialValues(material, { anchor: 'world' }, 'scene', 'camera').anchor).toBe('world');
    expect(materialValues(material, undefined, 'scene', 'world').depth).toBe('scene');
    expect(materialValues(material, undefined, 'scene', 'position').depth).toBe('background');
    expect(materialValues(material, { depth: 'foreground' }, 'scene', 'camera').depth).toBe(
      'foreground',
    );
  });

  it('draws a sky not fixed in the world behind the objects unless it is in front of them', () => {
    expect(anchoredDepth('scene', 'world')).toBe('scene');
    expect(anchoredDepth('scene', 'position')).toBe('background');
    expect(anchoredDepth('scene', 'camera')).toBe('background');
    expect(anchoredDepth('foreground', 'camera')).toBe('foreground');
    expect(anchoredDepth('background', 'position')).toBe('background');
  });
});

describe('the sky’s place for a camera', () => {
  it('undoes a view to the world and finds its eye', () => {
    for (const v of cameras) {
      expectClose(
        multiplyMatrices(v, rigidInverse(v)),
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      );
      expectClose(apply(v, eyeOf(v)), [0, 0, 0]);
    }
    expectClose(eyeOf(reference), [0, -41.2, 5.6]);
  });

  it('leaves a sky fixed in the world where it is', () => {
    for (const v of cameras) {
      expectClose(
        skyTransform('world', v, reference),
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      );
      expect(anchoredView('world', v, v, reference)).toBe(v);
    }
  });

  it('shows a sky anchored to the camera as the scene’s camera sees it, from any camera', () => {
    for (const v of cameras) expectClose(anchoredView('camera', v, v, reference), reference);
  });

  it('moves a sky anchored to the camera’s position by the eyes’ difference, keeping its directions', () => {
    for (const v of cameras) {
      const m = skyTransform('position', v, reference);
      // No turn: its directions are the world's.
      expectClose(
        [m[0]!, m[1]!, m[2]!, m[4]!, m[5]!, m[6]!, m[8]!, m[9]!, m[10]!],
        [1, 0, 0, 0, 1, 0, 0, 0, 1],
      );
      const [fx, fy, fz] = eyeOf(v);
      const [lx, ly, lz] = eyeOf(reference);
      expectClose([m[12]!, m[13]!, m[14]!], [fx - lx, fy - ly, fz - lz]);
      // Seen from the scene's camera's eye, turned as the camera is.
      const seen = anchoredView('position', v, v, reference);
      expectClose(eyeOf(seen), [lx, ly, lz]);
      expectClose(
        [seen[0]!, seen[1]!, seen[2]!, seen[4]!, seen[5]!, seen[6]!],
        [v[0]!, v[1]!, v[2]!, v[4]!, v[5]!, v[6]!],
      );
    }
  });

  it('puts the sky where it is for the followed camera when another draws (seen from outside)', () => {
    const [follow, drawing] = [cameras[0]!, cameras[1]!];
    const placed = skyTransform('camera', follow, reference);
    for (const p of points) {
      // The followed camera sees each of its points where the scene's camera sees them unmoved...
      expectClose(apply(follow, apply(placed, p)), apply(reference, p));
      // ...and the camera that draws sees them there in the world.
      expectClose(
        apply(anchoredView('camera', drawing, follow, reference), p),
        apply(drawing, apply(placed, p)),
      );
    }
    const moved = skyTransform('position', follow, reference);
    for (const p of points) {
      const at = apply(moved, p);
      const [fx, fy, fz] = eyeOf(follow);
      const [lx, ly, lz] = eyeOf(reference);
      expectClose(at, [p[0] + fx - lx, p[1] + fy - ly, p[2] + fz - lz]);
    }
  });
});
