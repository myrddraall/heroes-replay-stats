import { describe, expect, it } from 'vitest';
import {
  addedShades,
  bodyLights,
  dataActivation,
  dataReveal,
  fieldLights,
  linkedSettings,
  lightsForMoons,
  newLight,
  reaches,
  revealFrom,
  withAddedLights,
  colourAndStrength,
  mergeLightSettings,
  rgbOf,
  withLightSettings,
  withShadowSettings,
  reachesReceiver,
  withReceiver,
} from './scene-lights';
import { DEFAULT_SHADE, type PlanetLight } from './scene-planets';

/** Sanctuary's rig as the data has it: a dim fill, a dimmer back, a bright key. */
const rig: PlanetLight = {
  ambient: [0, 0, 0],
  directional: [
    { direction: [-0.32, -0.22, 0.92], color: [0.676, 0.4215, 0.2943] },
    { direction: [0.78, 0.32, 0.53], color: [0.299, 0.2357, 0.1513] },
    { direction: [-0.14, -0.11, -0.98], color: [7.852, 5.173, 2.771] },
  ],
  exposure: 1.5,
};

describe('a body’s lights', () => {
  it('are its rig’s, named by brightness, and its shadow', () => {
    const lights = bodyLights(rig, DEFAULT_SHADE);
    expect(lights.map((l) => [l.id, l.kind, l.name])).toEqual([
      ['ambient', 'ambient', 'Ambient light'],
      ['directional-0', 'directional', 'Fill light'],
      ['directional-1', 'directional', 'Back light'],
      ['directional-2', 'directional', 'Key light'],
      ['shadow', 'shadow', 'Antilight'],
    ]);
    // A light comes from where it shines from: against the way it travels.
    const key = lights[3]!;
    key.from!.forEach((v, i) => expect(v).toBeCloseTo([0.14, 0.11, 0.98][i]!, 1));
    expect(key.strength).toBeCloseTo(7.852);
  });

  it('are only the shadow for a body without a rig (its materials aren’t lit)', () => {
    expect(bodyLights(undefined, DEFAULT_SHADE).map((l) => l.id)).toEqual(['shadow']);
  });

  it('are a colour and a strength, the colour at its brightest channel 1', () => {
    expect(colourAndStrength([2, 1, 0])).toEqual({ colour: '#ff8000', strength: 2 });
    rgbOf('#ff8000', 2).forEach((v, i) => expect(v).toBeCloseTo([2, 1.004, 0][i]!, 2));
    expect(colourAndStrength([0, 0, 0])).toEqual({ colour: '#ffffff', strength: 0 });
  });

  it('leave the rig as it is where nothing is set', () => {
    expect(withLightSettings(rig, {})).toEqual(rig);
    expect(withLightSettings(rig, undefined)).toBe(rig);
  });

  it('set a light’s colour, strength and side, or switch it off', () => {
    const set = withLightSettings(rig, {
      'directional-2': { strength: 4, from: [0, -1, 0] },
      'directional-0': { enabled: false },
      ambient: { colour: '#ffffff', strength: 0.2 },
    });
    expect(set.directional[2]!.direction).toEqual([-0, 1, -0]);
    expect(Math.max(...set.directional[2]!.color)).toBeCloseTo(4);
    expect(set.directional[0]!.color).toEqual([0, 0, 0]);
    expect(set.ambient).toEqual([0.2, 0.2, 0.2]);
  });

  it('set the shadow, or switch it off', () => {
    const shade = { ...DEFAULT_SHADE, strength: 0.6 };
    expect(withShadowSettings(shade, { enabled: false }).strength).toBe(0);
    expect(withShadowSettings(shade, { from: [1, 0, 0], softness: 2 })).toEqual({
      direction: [1, 0, 0],
      strength: 0.6,
      softness: 2,
    });
  });

  it('merge their settings level over level, each its own', () => {
    expect(
      mergeLightSettings({ shadow: { strength: 0.5, softness: 2 } }, { shadow: { strength: 0.8 } }),
    ).toEqual({ shadow: { strength: 0.8, softness: 2 } });
  });

  it('add lights to a rig: ambient into its ambient, directional after its own', () => {
    const blue = {
      ...newLight('directional', []),
      colour: '#0000ff',
      strength: 2,
      from: [1, 0, 0] as const,
    };
    const fill = { ...newLight('ambient', []), strength: 0.5 };
    const lit = withAddedLights(rig, [blue, fill], undefined, 1.5)!;
    expect(lit.directional).toHaveLength(4);
    expect(lit.directional[3]).toEqual({ direction: [-1, -0, -0], color: [0, 0, 2] });
    expect(lit.ambient).toEqual([0.5, 0.5, 0.5]);
    // Switched off where it is added to: none of its light.
    const off = withAddedLights(rig, [blue], { [blue.id]: { enabled: false } }, 1.5);
    expect(off).toBe(rig);
  });

  it('light a body without a rig by added lights alone, at the scene’s exposure', () => {
    expect(withAddedLights(undefined, [], undefined, 1.5)).toBeUndefined();
    const lit = withAddedLights(undefined, [newLight('directional', [])], undefined, 1.5)!;
    expect(lit.exposure).toBe(1.5);
    expect(lit.directional).toHaveLength(1);
  });

  it('add shadows as shades of their own', () => {
    const shadow = newLight('shadow', []);
    expect(addedShades([shadow], undefined)).toEqual([
      { direction: shadow.from, strength: 0.5, softness: 1 },
    ]);
  });

  it('name new lights after those of their kind there are', () => {
    const one = newLight('directional', []);
    expect(one.name).toBe('Directional light');
    expect(newLight('directional', [one]).name).toBe('Directional light 2');
    expect(newLight('directional', [one]).id).not.toBe(one.id);
  });

  it('reach all of their body unless linked: only the parts and materials named, or all but them', () => {
    expect(reaches(undefined, 'own:surface', 'rock')).toBe(true);
    const only = { mode: 'only', receivers: ['part:style:shield'] } as const;
    expect(reaches(only, 'style:shield', 'grid')).toBe(true); // a part stands for its materials
    expect(reaches(only, 'own:surface', 'rock')).toBe(false);
    const except = { mode: 'except', receivers: ['material:rock'] } as const;
    expect(reaches(except, 'own:surface', 'rock')).toBe(false);
    expect(reaches(except, 'own:surface', 'glow')).toBe(true);
  });

  it('are switched off where they don’t reach (a rig’s by its settings, an added one by its own)', () => {
    const lamp = {
      ...newLight('directional', []),
      reach: { mode: 'only', receivers: ['material:glow'] },
    } as const;
    const settings = {
      'directional-0': { reach: { mode: 'except', receivers: ['part:own:surface'] } },
    } as const;
    const onRock = linkedSettings(settings, [lamp], 'own:surface', 'rock')!;
    expect(onRock['directional-0']?.enabled).toBe(false);
    expect(onRock[lamp.id]?.enabled).toBe(false);
    const onGlow = linkedSettings(settings, [lamp], 'own:halo', 'glow')!;
    expect(onGlow['directional-0']?.enabled).toBeUndefined();
    expect(onGlow[lamp.id]).toBeUndefined();
    // Nothing linked: the settings as they are.
    expect(linkedSettings(undefined, [], 'own:surface', 'rock')).toBeUndefined();
  });

  it('reach a body’s moons only where set to, whole and as set', () => {
    const lamp = newLight('directional', []);
    const other = newLight('ambient', [lamp]);
    const moons = lightsForMoons([lamp, other], {
      [lamp.id]: {
        moons: true,
        strength: 3,
        reach: { mode: 'only', receivers: ['part:own:surface'] },
      },
    });
    expect(moons.map((l) => l.id)).toEqual([lamp.id]);
    expect(moons[0]!.strength).toBe(3);
    expect(moons[0]!.reach).toBeUndefined();
    // Switched off: not on the moons either.
    expect(lightsForMoons([{ ...lamp, moons: true, enabled: false }], undefined)).toEqual([]);
  });

  it('reveal and activate grids only: not lights that light a body', () => {
    const reveal = newLight('reveal', []);
    const activation = { ...newLight('activation', []), strength: 0.5 };
    // A body without a rig stays unlit with only grid lights added.
    expect(withAddedLights(undefined, [reveal, activation], undefined, 1.5)).toBeUndefined();
    expect(fieldLights('reveal', [reveal, activation], undefined)).toEqual([
      { from: reveal.from, spread: 1, falloff: 1, strength: 2 },
    ]);
    expect(fieldLights('activation', [reveal, activation], undefined)[0]!.strength).toBe(0.5);
    expect(newLight('activation', []).strength).toBe(1);
    // A new activation light only colours: it energizes nothing, nor glows, until set to.
    expect(fieldLights('activation', [activation], undefined)[0]!.energizes).toBe(0);
    expect(fieldLights('activation', [activation], undefined)[0]!.glow).toBe(0);
    expect(fieldLights('activation', [activation], { [activation.id]: { glow: 1 } })[0]!.glow).toBe(
      1,
    );
    expect(
      fieldLights('activation', [activation], { [activation.id]: { energizes: 1.5 } })[0]!
        .energizes,
    ).toBe(1.5);
    // Switched off where added: none.
    expect(
      fieldLights('activation', [activation], { [activation.id]: { enabled: false } }),
    ).toEqual([]);
  });

  it('give a grid its own reveal light, revealing all its face from the front, and its activation light', () => {
    const front = { from: [0, -1, 0] as const, spread: 1, falloff: 1 };
    expect(dataReveal(undefined)).toEqual({ ...front, strength: 2 });
    expect(dataReveal({ spread: 0.2, strength: 3 })).toEqual({
      ...front,
      spread: 0.2,
      strength: 3,
    });
    expect(dataReveal({ enabled: false })).toBeNull();
    const lights = bodyLights(undefined, DEFAULT_SHADE, {}, true);
    expect(lights.map((l) => [l.id, l.kind, l.name])).toEqual([
      ['shadow', 'shadow', 'Antilight'],
      ['reveal', 'reveal', 'Reveal light'],
      ['activation', 'activation', 'Activation light'],
    ]);
    // Its activation light switched off until switched on, its side tied to the reveal's.
    const activation = lights.find((l) => l.id === 'activation')!;
    expect(activation.enabled).toBe(false);
    expect(activation.tied).toBe(true);
    // As the reveal is, not as strongly, energizing a little (a quarter of what it activates).
    expect(dataActivation(undefined)).toBeNull();
    expect(dataActivation({ enabled: true })).toEqual({
      ...front,
      strength: 1,
      energizes: 0.25,
      glow: 0.5,
      tied: true,
    });
    expect(dataActivation({ enabled: true, glow: 2 })!.glow).toBe(2);
    expect(dataActivation({ enabled: true, energizes: 0 })!.energizes).toBe(0);
    expect(dataActivation({ enabled: true, tied: false })!.tied).toBe(false);
    // The side a tied activation takes: the reveal light's as set.
    expect(revealFrom(undefined)).toEqual([0, -1, 0]);
    expect(revealFrom({ reveal: { from: [1, 0, 0] } })).toEqual([1, 0, 0]);
  });
});

describe('what a light reaches, from what it lights', () => {
  // A surface of ground and haze, a shell of haze.
  const parts = new Map([
    ['own:surface', ['ground', 'haze']],
    ['own:shell', ['haze']],
  ]);

  it('tells whether it reaches a part (any of its materials) or a material (on any part)', () => {
    expect(reachesReceiver(undefined, 'part:own:shell', parts)).toBe(true);
    const noHaze = { mode: 'except', receivers: ['material:haze'] } as const;
    expect(reachesReceiver(noHaze, 'part:own:shell', parts)).toBe(false);
    expect(reachesReceiver(noHaze, 'part:own:surface', parts)).toBe(true);
    const shellOnly = { mode: 'only', receivers: ['part:own:shell'] } as const;
    // The haze on the shell is reached; the ground isn't.
    expect(reachesReceiver(shellOnly, 'material:haze', parts)).toBe(true);
    expect(reachesReceiver(shellOnly, 'material:ground', parts)).toBe(false);
  });

  it('leaves a part or material out, and takes it back in', () => {
    const out = withReceiver(undefined, 'part:own:shell', false, parts);
    expect(out).toEqual({ mode: 'except', receivers: ['part:own:shell'] });
    // Back in: reaching everything again.
    expect(withReceiver(out, 'part:own:shell', true, parts)).toBeUndefined();
    // An only reach: taken out of its list.
    const only = { mode: 'only', receivers: ['part:own:shell', 'material:ground'] } as const;
    expect(withReceiver(only, 'material:ground', false, parts)).toEqual({
      mode: 'only',
      receivers: ['part:own:shell'],
    });
    expect(withReceiver(only, 'part:own:surface', true, parts)!.receivers).toContain(
      'part:own:surface',
    );
  });

  it('names a part by its other materials where one of them is taken apart from it', () => {
    // Only the surface: the haze on it left out leaves the ground.
    const surface = { mode: 'only', receivers: ['part:own:surface'] } as const;
    expect(withReceiver(surface, 'material:haze', false, parts)).toEqual({
      mode: 'only',
      receivers: ['material:ground'],
    });
    // All but the surface: the ground taken back in leaves the haze out.
    const notSurface = { mode: 'except', receivers: ['part:own:surface'] } as const;
    expect(withReceiver(notSurface, 'material:ground', true, parts)).toEqual({
      mode: 'except',
      receivers: ['material:haze'],
    });
  });
});
