import { describe, expect, it } from 'vitest';
import { gradesUniforms, layerBrightness, tintsUniforms } from './draw-uniforms';
import { UniformSet } from './uniforms';
import { BLEND_MODES } from '../../tints/tints';
import { MAX_GRADES } from '../../tints/grading';

describe('layerBrightness', () => {
  it('squares the data multiplier', () => {
    expect(layerBrightness(0.3)).toBeCloseTo(0.09);
    expect(layerBrightness(1)).toBe(1);
  });
});

describe('tintsUniforms', () => {
  it("packs each tint's rows: colour and strength, kind and blend and stage, its shift, its mask, its stops in order", () => {
    const u = new UniformSet();
    tintsUniforms(u, 'uTint', [
      { id: 'a', kind: 'colour', colour: '#ff0000', blend: 'screen', strength: 0.5 },
      {
        id: 'b',
        kind: 'gradient',
        strength: 1,
        stage: 'surface',
        mask: { by: 'facing', from: 0.2, to: 0.8, invert: true },
        stops: [
          { at: 1, colour: '#ffffff' },
          { at: 0, colour: '#000000' },
        ],
      },
      {
        id: 'c',
        kind: 'hsl',
        hue: 180,
        saturation: -0.5,
        lightness: 0.25,
        strength: 1,
        mask: { by: 'layer', layer: 'mask1', channel: 'luma' },
      },
    ]);
    const row = (r: string, i: number) => [...u.values.get(`uTint${r}`)!.value].slice(i * 4, i * 4 + 4);
    expect([...u.values.get('uTintCount')!.value]).toEqual([3]);
    expect(row('A', 0)).toEqual([1, 0, 0, 0.5]);
    expect(row('B', 0)).toEqual([0, BLEND_MODES.screen, 0, 0]);
    expect(row('B', 1)).toEqual([2, 0, 1, 2]);
    expect(row('D', 1)).toEqual([2, 0, 0, 1]);
    expect(row('E', 1)).toEqual([0.2, 0.8, 0, 0].map(Math.fround));
    expect(row('F', 1)).toEqual([0, 0, 0, 0]); // the stops by where they are
    expect(row('G', 1)).toEqual([1, 1, 1, 1]);
    expect(row('C', 2).map((v) => +v.toFixed(4))).toEqual([+Math.PI.toFixed(4), -0.5, 0.25, 0]);
    expect(row('D', 2)).toEqual([1, 2, 4, 0]);
  });
});

describe('tintsUniforms, levels', () => {
  it("packs a levels tint's input (low, high, gamma) and output (low, high) where the stops would be", () => {
    const u = new UniformSet();
    tintsUniforms(u, 'uTint', [
      {
        id: 'l',
        kind: 'levels',
        strength: 1,
        inputLow: 0.25,
        inputHigh: 0.75,
        gamma: 2,
        outputLow: 0,
        outputHigh: 0.5,
      },
    ]);
    const row = (r: string) => [...u.values.get(`uTint${r}`)!.value].slice(0, 4);
    expect(row('B')[0]).toBe(3);
    expect(row('F')).toEqual([0.25, 0.75, 2, 0]);
    expect(row('G')).toEqual([0, 0.5, 0, 0]);
  });
});

describe('gradesUniforms', () => {
  it("packs the grading shown first and the one it fades from after MAX_GRADES, each tint's kind, strength and values", () => {
    const u = new UniformSet();
    gradesUniforms(
      u,
      [
        { id: 'b', kind: 'brightness-contrast', strength: 0.5, brightness: 1, contrast: 1.5 },
        {
          id: 'g',
          kind: 'lift-gamma-gain',
          strength: 1,
          lift: { colour: '#ffffff', amount: 0.1 },
          gamma: { colour: '#ffffff', amount: 2 },
          gain: { colour: '#ffffff', amount: 1.5 },
        },
      ],
      [{ id: 'w', kind: 'white-balance', strength: 1, temperature: 6500, tint: 0 }],
    );
    const row = (r: string, i: number) =>
      [...u.values.get(`uGrade${r}`)!.value].slice(i * 4, i * 4 + 4).map((v) => +v.toFixed(4));
    expect([...u.values.get('uGradeCount0')!.value]).toEqual([2]);
    expect([...u.values.get('uGradeCount1')!.value]).toEqual([1]);
    expect(row('A', 0)).toEqual([1, 0.5, 0, 0]);
    expect(row('B', 0)).toEqual([2, 1.5, 0, 0]);
    expect(row('A', 1)).toEqual([2, 1, 0, 0]);
    expect(row('B', 1)).toEqual([0.1, 0.1, 0.1, 0]);
    expect(row('C', 1)).toEqual([0.5, 0.5, 0.5, 0]);
    expect(row('D', 1)).toEqual([1.5, 1.5, 1.5, 0]);
    expect(row('A', MAX_GRADES)).toEqual([0, 1, 0, 0]);
    expect(row('B', MAX_GRADES)).toEqual([1, 1, 1, 0]); // 6500 K: as it is
  });
});
