import { describe, expect, it } from 'vitest';
import {
  materialControls,
  materialValues,
  mergeMaterialSettings,
  ownSpread,
} from './material-settings';
import type { SceneMaterial } from './play-scene';

const material = (over: Partial<SceneMaterial> = {}): SceneMaterial => ({
  blend: 'alphaAdd',
  unshaded: true,
  vertexAlpha: false,
  vertexColor: false,
  emissiveMult: 1,
  diffuse: null,
  emissive: null,
  alphaMasks: [],
  ...over,
});
const fresnel = (min: number) => ({ type: 1, exponent: 1, min, max: 1, yaw: 0, pitch: 0 });

describe('materials’ settings', () => {
  it('merge the later layers over the earlier, each setting its own', () => {
    expect(
      mergeMaterialSettings(
        { haze: { strength: 0.42, glow: 1 }, ring: { strength: 1 } },
        undefined,
        { haze: { strength: 0.8 }, shield: { spread: 0.6 } },
      ),
    ).toEqual({ haze: { strength: 0.8, glow: 1 }, ring: { strength: 1 }, shield: { spread: 0.6 } });
  });

  it('show the material’s own blend and fresnel floor where nothing is set', () => {
    const m = material({
      blend: 'add',
      diffuse: { color: [1, 2, 3, 255], brightMult: 1, fresnel: fresnel(0.1) },
      alphaMasks: [{ texture: 't', brightMult: 1, fresnel: fresnel(0.3) }],
    });
    expect(ownSpread(m)).toBe(0.3);
    expect(ownSpread(material())).toBe(0);
    const v = materialValues(m, undefined);
    expect(v).toMatchObject({
      enabled: true,
      strength: 1,
      blend: 'add',
      glow: 1,
      spread: 0.3,
      scale: 1,
    });
    expect(v.tint).toEqual({ colour: '#ffffff', blend: 'multiply', strength: 0 });
    expect(materialValues(m, { blend: 'alpha', spread: 0, enabled: false })).toMatchObject({
      enabled: false,
      blend: 'alpha',
      spread: 0,
    });
  });

  it('offer only the controls that do anything', () => {
    expect(materialControls(material({ blend: 'opaque' }), false)).toEqual({
      strength: false,
      spread: false,
      scale: false,
      cut: false,
      lines: false,
    });
    const emissive = material({
      emissive: { texture: 'grid', brightMult: 1, fresnel: fresnel(0) },
    });
    expect(materialControls(emissive, false)).toEqual({
      strength: true,
      spread: true,
      scale: true,
      cut: true,
      lines: false,
    });
    // A drawn pattern: its lines are set, not a texture's range.
    expect(materialControls(emissive, true)).toMatchObject({
      scale: true,
      cut: false,
      lines: true,
    });
  });
});
