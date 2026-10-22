import { describe, expect, it } from 'vitest';
import { newLight, SHIELD_DEFAULTS, withLightChanged } from './scene-lights';
import {
  DEFAULT_GRID_LIGHTS,
  gridFields,
  gridLightsOf,
  RIM_LIGHT,
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
      spread: false,
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

  it('reveal a grid by its rim alone where no light is set: its material’s own lean, spread and falloff', () => {
    const v = materialValues(material(), undefined);
    expect(v.gridLights).toEqual(DEFAULT_GRID_LIGHTS);
    const { reveal, activation } = gridFields(v);
    expect(reveal).toMatchObject([
      { kind: 'rim', from: v.spreadFrom, fade: v.spread, falloff: v.falloff, strength: 1 },
    ]);
    expect(reveal[0]!.aim).toHaveLength(3);
    expect(activation).toEqual([]);
    // Its lean, spread and falloff set on the light, over the material's.
    const leaned = gridFields(
      materialValues(material(), {
        gridLights: [{ ...RIM_LIGHT, from: [1, 0, 0], fade: 0.5, softness: 3 }],
      }),
    );
    expect(leaned.reveal[0]).toMatchObject({ from: [1, 0, 0], fade: 0.5, falloff: 3 });
  });

  it('reveal and activate a grid by each of its lights that does (lights like a body’s), one switched off doing neither', () => {
    const right = [1, 0, 0] as const;
    const both = {
      ...newLight('directional', []),
      from: right,
      wrap: 1,
      shield: { activates: true },
    };
    const all = newLight('ambient', [both]);
    const anti = { ...newLight('antilight', []), strength: 0.5, wrap: 0.5 };
    const off = { ...newLight('directional', []), enabled: false };
    const spot = { ...newLight('spot', []), lookAt: { kind: 'body', at: [0, -1, 0] } as const };
    const sky = newLight('environment', []);
    const { reveal, activation } = gridFields(
      materialValues(material(), { gridLights: [both, all, anti, off, spot, sky] }),
    );
    // Revealing: the one doing both, the one from all round, the antilight hiding, the spot and the sky.
    expect(reveal).toMatchObject([
      { from: right, reach: 1, falloff: 1, strength: 1 },
      { reach: 0, falloff: 1, strength: 0.2 },
      { from: anti.from, reach: 0.5, falloff: 1, strength: -0.5 },
      { kind: 'spot', position: [0, -2.5, 1.5], cone: 15, edge: 0.5, reach: 0 },
      { kind: 'environment', fade: 1.5, strength: 1 },
    ]);
    expect(reveal[3]!.aim!.map((v) => Math.round(v * 1000) / 1000)).toEqual([0, 0.707, -0.707]);
    // Activating, from the same side as it reveals: the one doing both.
    expect(activation).toEqual([
      {
        from: right,
        reach: 1,
        falloff: 1,
        strength: 1,
        energizes: SHIELD_DEFAULTS.energizes,
        glow: SHIELD_DEFAULTS.glow,
      },
    ]);
    expect(withLightChanged([both, all], both.id, { enabled: false })[0]!.enabled).toBe(false);
  });

  it('read a reveal and activation of before, and lights kept as the shield’s own kind, as lights', () => {
    const right = [1, 0, 0] as const;
    const left = [-1, 0, 0] as const;
    const before = { activationOn: true, revealFrom: right, activationFrom: left };
    // (The rim, which was the grid's look under them, first.)
    const [rim, reveal, activation] = gridLightsOf(before);
    expect(rim).toEqual(RIM_LIGHT);
    expect(reveal).toMatchObject({ from: right, strength: 2, wrap: 1 });
    // Tied (as it was unless set): from the reveal's side.
    expect(activation).toMatchObject({
      from: right,
      strength: 1,
      shield: { reveals: false, activates: true },
    });
    expect(gridLightsOf({ ...before, activationTied: false })[2]!.from).toEqual(left);
    expect(gridLightsOf({ revealOn: false })).toEqual([RIM_LIGHT]);
    // One kept as the shield's own kind of light: its reach its wrap, what it did its shield effect.
    const kept = gridLightsOf({
      gridLights: [
        {
          id: 'grid-x',
          name: 'Front',
          kind: 'directional',
          strength: 2,
          reach: 0.5,
          activates: true,
        },
      ],
    });
    expect(kept[0]).toMatchObject({
      id: 'added-grid-x',
      kind: 'directional',
      strength: 2,
      wrap: 0.5,
      shield: { activates: true },
    });
  });
});
