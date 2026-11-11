import { describe, expect, it } from 'vitest';
import type { SceneMaterial } from '@myrddraall/heroes-replay-stats-aether/formats';
import { materialControls } from './material-controls';

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

describe('materials’ controls', () => {
  it('offer only the controls that do anything', () => {
    expect(materialControls(material({ blend: 'opaque' }))).toEqual({
      strength: false,
      spread: false,
      colours: false,
      scale: false,
      drawAs: false,
      cut: false,
      lines: false,
      particles: false,
      depth: false,
      anchor: false,
      lit: true,
      specular: false,
      orientation: true,
    });
    const emissive = material({
      emissive: { texture: 'grid', brightMult: 1, fresnel: fresnel(0) },
    });
    expect(materialControls(emissive)).toEqual({
      strength: true,
      spread: true,
      colours: false,
      scale: true,
      drawAs: false,
      cut: true,
      lines: false,
      particles: false,
      depth: false,
      anchor: false,
      lit: true,
      specular: false,
      orientation: true,
    });
    // A specular layer: its shine is set.
    expect(
      materialControls(material({ specular: { texture: 'rock', brightMult: 1 } })).specular,
    ).toBe(true);
    // A drawn pattern: its lines are set, not a texture's range; a grid's colours too (its own
    // fade, spread and its side, still its own: its reveal lights say where it shows).
    expect(materialControls(emissive, { pattern: true })).toMatchObject({
      scale: true,
      cut: false,
      lines: true,
      colours: true,
      spread: false,
    });
    // Shown as its texture instead (the game's way): the texture's range again, no lines.
    expect(materialControls(emissive, { pattern: true, drawAs: 'texture' })).toMatchObject({
      drawAs: true,
      cut: true,
      lines: false,
    });
    // A particle system's: drawn or not, its strength, and (the sky's) its depth and anchor.
    expect(materialControls(emissive, { particles: true, sky: true })).toEqual({
      strength: true,
      spread: false,
      colours: false,
      scale: false,
      drawAs: false,
      cut: false,
      lines: false,
      particles: true,
      depth: true,
      anchor: true,
      lit: false,
      specular: false,
      orientation: false,
    });
  });
});
