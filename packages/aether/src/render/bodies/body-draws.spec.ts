import { describe, expect, it } from 'vitest';
import type { SceneBlend, SceneMaterial } from '../../formats/play-scene';
import type { MeshDraw } from '../draw-types';
import { withoutHidden } from './body-draws';

const state = (
  name: string,
  blend: SceneBlend,
  { part = 'own:sphere', enabled = true, cutout = 0, pattern = false } = {},
) => ({
  name,
  blend,
  enabled,
  material: { cutout } as SceneMaterial,
  draw: { partKey: part, part: pattern ? { pattern: { kind: 'hex' } } : {} } as unknown as MeshDraw,
});
const names = (states: readonly { readonly name: string }[]) => states.map((s) => s.name);

describe("a body's draws less those hidden", () => {
  it('leave out an opaque one under a later opaque one on the same part; keep what is blended over', () => {
    const ground = state('ground', 'opaque');
    const surface = state('surface', 'opaque');
    const clouds = state('clouds', 'alpha');
    expect(names(withoutHidden([ground, surface, clouds]))).toEqual(['surface', 'clouds']);
    // Another part's opaque one covers nothing of this one's.
    const ring = state('ring', 'opaque', { part: 'own:ring' });
    expect(names(withoutHidden([ground, ring]))).toEqual(['ground', 'ring']);
  });

  it('keep the one under where the later is off, cuts holes, or its part has a pattern', () => {
    const ground = state('ground', 'opaque');
    expect(names(withoutHidden([ground, state('off', 'opaque', { enabled: false })]))).toEqual([
      'ground',
      'off',
    ]);
    expect(names(withoutHidden([ground, state('cut', 'opaque', { cutout: 0.5 })]))).toEqual([
      'ground',
      'cut',
    ]);
    expect(names(withoutHidden([ground, state('hex', 'opaque', { pattern: true })]))).toEqual([
      'ground',
      'hex',
    ]);
  });
});
