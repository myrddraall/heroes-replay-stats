import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GRID_LIGHTS,
  GRID_LIGHT_DEFAULTS,
  gridFields,
  gridLightsOf,
  newGridLight,
  withGridLight,
  materialControls,
  materialValues,
  mergeMaterialSettings,
  ownSpread,
  originsOf,
  ownSpreadFrom,
} from './material-settings';
import { rimTurn, TOWARDS_EYE } from './scene-directions';
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
  it('merge their layers’ settings one by one, a level setting one leaving the rest', () => {
    const merged = mergeMaterialSettings(
      { grid: { layers: { emissive: { tiling: [4, 4], rotation: 10 } } } },
      { grid: { strength: 0.5 } },
      { grid: { layers: { emissive: { rotation: 30 }, mask1: { offset: [0.1, 0] } } } },
    );
    expect(merged['grid']).toEqual({
      strength: 0.5,
      layers: { emissive: { tiling: [4, 4], rotation: 30 }, mask1: { offset: [0.1, 0] } },
    });
  });

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
      lit: true,
      specular: false,
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
      lit: true,
      specular: false,
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
      spread: true,
    });
    // Shown as its texture instead (the game's way): the texture's range again, no lines.
    expect(materialControls(emissive, { pattern: true, drawAs: 'texture' })).toMatchObject({
      drawAs: true,
      cut: true,
      lines: false,
    });
    // A particle system's: drawn or not, its strength, and (the sky's) its depth.
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
      lit: false,
      specular: false,
    });
  });

  it('spread from where their fresnel turns to, a turn rimTurn gives back', () => {
    const turned = { ...fresnel(0.2), yaw: 0.5236, pitch: -0.43633 };
    const from = ownSpreadFrom(material({ emissive: { brightMult: 1, fresnel: turned } }));
    // Brightest opposite where the turn leans: to the left and down.
    expect(rimTurn(from)[0]).toBeCloseTo(-0.5236, 4);
    expect(rimTurn(from)[1]).toBeCloseTo(0.43633, 4);
    expect(ownSpreadFrom(material())).toEqual(TOWARDS_EYE);
    expect(
      materialValues(material({ emissive: { brightMult: 1, fresnel: turned } }), {
        spreadFrom: [1, 0, 0],
      }).spreadFrom,
    ).toEqual([1, 0, 0]);
  });

  it('say which level sets each setting: the last that does', () => {
    expect(
      originsOf<'strength' | 'glow' | 'scale'>([
        ['its tuning', { strength: 0.5, glow: 2 }],
        ['the library (material)', undefined],
        ['the library (planet)', { glow: 1, scale: undefined }],
      ]),
    ).toEqual({ strength: 'its tuning', glow: 'the library (planet)' });
  });

  it('reveal a grid from the front, its whole face, by one light of its own where none is set', () => {
    const v = materialValues(material(), undefined);
    expect(v.gridLights).toEqual(DEFAULT_GRID_LIGHTS);
    const { reveal, activation } = gridFields(v);
    expect(reveal).toEqual([{ from: TOWARDS_EYE, reach: 1, falloff: 1, strength: 2 }]);
    expect(activation).toEqual([]);
  });

  it('reveal and activate a grid by each of its lights that does, one switched off doing neither', () => {
    const right = [1, 0, 0] as const;
    const both = { ...newGridLight('directional', []), from: right, activates: true };
    const all = newGridLight('ambient', [both]);
    const anti = { ...newGridLight('antilight', []), strength: 0.5 };
    const off = { ...newGridLight('directional', []), enabled: false };
    const { reveal, activation } = gridFields(
      materialValues(material(), { gridLights: [both, all, anti, off] }),
    );
    // Revealing: the one doing both, the one from all round (no side), the antilight hiding.
    expect(reveal).toEqual([
      { from: right, reach: 1, falloff: 1, strength: 1 },
      { reach: 1, falloff: 1, strength: 1 },
      { from: anti.from, reach: 1, falloff: 1, strength: -0.5 },
    ]);
    // Activating, from the same side as it reveals: the one doing both.
    expect(activation).toEqual([
      {
        from: right,
        reach: 1,
        falloff: 1,
        strength: 1,
        energizes: GRID_LIGHT_DEFAULTS.energizes,
        glow: GRID_LIGHT_DEFAULTS.glow,
      },
    ]);
    expect(withGridLight([both, all], both.id, { enabled: false })[0]!.enabled).toBe(false);
  });

  it('read a reveal and activation of before as lights of its own', () => {
    const right = [1, 0, 0] as const;
    const left = [-1, 0, 0] as const;
    const before = { activationOn: true, revealFrom: right, activationFrom: left };
    const [reveal, activation] = gridLightsOf(before);
    expect(reveal).toMatchObject({ from: right, strength: 2 });
    // Tied (as it was unless set): from the reveal's side.
    expect(activation).toMatchObject({ from: right, reveals: false, activates: true, strength: 1 });
    expect(gridLightsOf({ ...before, activationTied: false })[1]!.from).toEqual(left);
    expect(gridLightsOf({ revealOn: false })).toEqual([]);
  });
});
