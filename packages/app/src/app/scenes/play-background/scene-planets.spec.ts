import { describe, expect, it } from 'vitest';
import type { SceneLayer, SceneMaterial } from './play-scene';
import {
  type BodyPart,
  drawOrder,
  layerSlots,
  type Ordered,
  reordered,
  mergePartSettings,
  withLayer,
  withLayers,
  withPart,
  shapeReach,
} from './scene-planets';

const layer = (texture: string): SceneLayer => ({
  texture,
  brightMult: 1,
  offset: [0.1, 0],
  tiling: [2, 2],
  scroll: { seconds: 200, by: [1, 0] },
});

const material: SceneMaterial = {
  blend: 'alphaAdd',
  unshaded: true,
  vertexAlpha: false,
  vertexColor: false,
  emissiveMult: 1,
  diffuse: layer('paint'),
  emissive: layer('grid'),
  alphaMasks: [layer('mask-a'), layer('mask-b'), layer('mask-c')],
};

describe('a material’s layers', () => {
  it('are found by their slots, the first two masks of them', () => {
    expect(layerSlots(material).map(([slot]) => slot)).toEqual([
      'diffuse',
      'emissive',
      'mask1',
      'mask2',
    ]);
  });

  it('take their settings over the data’s, each where set', () => {
    const set = withLayer(layer('grid'), { rotation: 90, tiling: [5, 3], wrap: [false, true] });
    expect(set.angle).toBeCloseTo(Math.PI / 2);
    expect(set).toMatchObject({ tiling: [5, 3], wrap: [false, true], offset: [0.1, 0] });
  });

  it('scroll endlessly as set, or stop where set still', () => {
    expect(withLayer(layer('grid'), { scroll: [0.25, 0] }).scroll).toEqual({
      seconds: 1,
      by: [0.25, 0],
      endless: true,
    });
    expect(withLayer(layer('grid'), { scroll: [0, 0] }).scroll).toBeUndefined();
    expect(withLayer(layer('grid'), {}).scroll).toEqual(layer('grid').scroll);
  });

  it('read another texture only where it is loaded', () => {
    const loaded = (t: string) => t === 'stars';
    expect(withLayer(layer('grid'), { texture: 'stars' }, loaded).texture).toBe('stars');
    expect(withLayer(layer('grid'), { texture: 'elsewhere' }, loaded).texture).toBe('grid');
  });

  it('are set on a material by slot, leaving it as it is where nothing is set', () => {
    expect(withLayers(material, undefined)).toBe(material);
    const set = withLayers(material, {
      mask2: { texture: 'mask-a' },
      diffuse: { offset: [0, 0.5] },
    });
    expect(set.alphaMasks.map((m) => m.texture)).toEqual(['mask-a', 'mask-a', 'mask-c']);
    expect(set.diffuse?.offset).toEqual([0, 0.5]);
    expect(set.emissive).toEqual(material.emissive);
  });
});

const sphere: BodyPart = {
  role: 'shell',
  shape: { kind: 'sphere', radius: 1.2, side: 'far' },
  mapping: {
    kind: 'sphere',
    pole: [0, 0, 1],
    meridian: [0, -1, 0],
    flip: false,
    u0: 0,
    v: [0, 1],
  },
  materials: ['haze'],
};
const ring: BodyPart = {
  role: 'ring',
  shape: { kind: 'ring', inner: 0.8, outer: 1, depth: -0.2, seen: 12 },
  mapping: { kind: 'ring', from: 0, uMax: 1, mid: 0.25 },
  materials: ['ring'],
};

describe('a body’s parts', () => {
  it('are as they are where nothing is set', () => {
    expect(withPart(sphere, undefined)).toBe(sphere);
  });

  it('size a sphere by its own radius, and turn its textures about its pole and tilt its top', () => {
    const set = withPart(sphere, { size: 1.5, turn: 90, tilt: 90 });
    expect((set.shape as { radius: number }).radius).toBeCloseTo(1.8);
    const m = set.mapping as Extract<BodyPart['mapping'], { kind: 'sphere' }>;
    // Its meridian a quarter turn round its pole; then its pole tilted to the eye (-y).
    m.meridian.forEach((v, i) => expect(v).toBeCloseTo([1, 0, 0][i]!));
    m.pole.forEach((v, i) => expect(v).toBeCloseTo([0, -1, 0][i]!));
  });

  it('size a ring, widen it about its middle, move its plane, its brightest circle', () => {
    const set = withPart(ring, { size: 2, width: 0.5, depth: 0.1, mid: 0.5 });
    const shape = set.shape as Extract<BodyPart['shape'], { kind: 'ring' }>;
    expect(shape.inner).toBeCloseTo(1.7);
    expect(shape.outer).toBeCloseTo(1.9);
    expect(shape).toMatchObject({ depth: 0.1, seen: 12 });
    expect(set.mapping).toMatchObject({ mid: 0.5 });
  });

  it('mirror a sphere’s textures, and turn and repeat a ring’s round it', () => {
    expect(withPart(sphere, { flip: true }).mapping).toMatchObject({ flip: true });
    expect(withPart(ring, { from: 90, repeat: 3 }).mapping).toMatchObject({
      from: Math.PI / 2,
      uMax: 3,
      mid: 0.25,
    });
  });

  it('let a ring go of its body’s limb', () => {
    expect(withPart(ring, { keepToLimb: false }).shape).not.toHaveProperty('seen');
    expect(withPart(ring, { keepToLimb: true }).shape).toHaveProperty('seen', 12);
  });

  it('merge their settings level over level, each its own', () => {
    expect(
      mergePartSettings({ 'own:shell': { size: 2, turn: 10 } }, { 'own:shell': { turn: 30 } }),
    ).toEqual({ 'own:shell': { size: 2, turn: 30 } });
  });
});

describe('the order materials are drawn in', () => {
  const m = (name: string, blend: Ordered['blend'], priority?: number): Ordered => ({
    name,
    blend,
    priority,
  });
  const materials = [
    m('glow', 'alphaAdd'),
    m('surface', 'opaque'),
    m('ring', 'alpha', 5),
    m('grid', 'alphaAdd'),
  ];

  it('puts the opaque first, then the rest by priority, ties as the data lists them', () => {
    expect(drawOrder(materials)).toEqual(['surface', 'ring', 'glow', 'grid']);
  });

  it('follows an order where one is set (the opaque still first, new names after)', () => {
    expect(drawOrder(materials, ['grid', 'surface', 'glow'])).toEqual([
      'surface',
      'grid',
      'glow',
      'ring',
    ]);
  });

  it('moves a material within its group, the other group’s places kept', () => {
    // A body's own (glow, ring) and its style's (grid, shield), drawn interleaved.
    const order = ['glow', 'grid', 'ring', 'shield'];
    expect(reordered(order, ['glow', 'ring'], 'ring', 'glow', false)).toEqual([
      'ring',
      'grid',
      'glow',
      'shield',
    ]);
  });

  it('moves a material from another group beside its target', () => {
    expect(reordered(['a', 'b', 'c', 'd'], ['c', 'd'], 'a', 'c', true)).toEqual([
      'b',
      'c',
      'a',
      'd',
    ]);
  });
});

describe('a tube, a cone and a disc', () => {
  const tube: BodyPart = {
    role: 'tube',
    shape: { kind: 'tube', radius: 1.2, length: 2.4, side: 'near' },
    mapping: {
      kind: 'round',
      axis: [0, 0, 1],
      meridian: [0, -1, 0],
      flip: false,
      u0: 0,
      repeat: 1,
      along: 'height',
      v0: 1.2,
      v1: -1.2,
    },
    materials: [],
  };

  it('are sized, lengthened, tilted and seen from inside as set, their texture along them still', () => {
    const set = withPart(tube, { size: 2, height: 0.5, tilt: 90, side: 'far', repeat: 3 });
    const shape = set.shape as Extract<BodyPart['shape'], { kind: 'tube' }>;
    expect(shape.radius).toBeCloseTo(2.4);
    expect(shape.length).toBeCloseTo(2.4);
    expect(shape.side).toBe('far');
    // Tilted its top towards the eye (-y): its axis lies along it.
    expect(shape.axis![1]).toBeCloseTo(-1);
    const mapping = set.mapping as Extract<BodyPart['mapping'], { kind: 'round' }>;
    expect(mapping.repeat).toBe(3);
    expect(mapping.v0).toBeCloseTo(1.2);
    expect(mapping.v1).toBeCloseTo(-1.2);
  });

  it('reach as far as their farthest edge', () => {
    expect(shapeReach(tube.shape)).toBeCloseTo(Math.hypot(1.2, 1.2));
    expect(shapeReach({ kind: 'cone', bottom: 2, top: 1, length: 2, side: 'near' })).toBeCloseTo(
      Math.hypot(2, 1),
    );
    expect(shapeReach({ kind: 'disc', inner: 1, outer: 1.9 })).toBeCloseTo(1.9);
  });
});
