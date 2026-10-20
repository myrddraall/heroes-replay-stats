import { describe, expect, it } from 'vitest';
import {
  addedShades,
  bodyLights,
  linkedSettings,
  lightsForMoons,
  newLight,
  reaches,
  withAddedLights,
  colourAndStrength,
  mergeLightSettings,
  rgbOf,
  withLightSettings,
  withShadowSettings,
  reachesReceiver,
  withReceiver,
  tunedRig,
  knownLights,
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

  it("leave out lights of kinds kept from before (a grid's reveal and activation, its material's now)", () => {
    const lamp = { ...newLight('ambient', []), id: 'added-lamp' as const };
    const old = { id: 'added-old', kind: 'reveal', name: 'Reveal light' };
    expect(knownLights([lamp, old])).toEqual([lamp]);
    // Not lighting a body either.
    const added = [lamp, old] as unknown as Parameters<typeof withAddedLights>[1];
    expect(withAddedLights(undefined, added, undefined, 1)!.ambient).toEqual(
      withAddedLights(undefined, [lamp], undefined, 1)!.ambient,
    );
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

describe("a body's rig as tuned", () => {
  const rig: PlanetLight = {
    ambient: [0.2, 0.2, 0.4],
    directional: [
      { direction: [0, 1, 0], color: [2, 2, 2] },
      { direction: [1, 0, 0], color: [0.5, 0.5, 0.5] },
    ],
    exposure: 1,
  };

  it('is the data where nothing is tuned', () => {
    expect(tunedRig(rig)).toBe(rig);
  });

  it('makes every light stronger together', () => {
    const half = tunedRig(rig, 0.5);
    expect(half.ambient).toEqual([0.1, 0.1, 0.2]);
    expect(half.directional.map((l) => l.color)).toEqual([
      [1, 1, 1],
      [0.25, 0.25, 0.25],
    ]);
    // As a light shows it: half as strong, the same colour.
    expect(bodyLights(half, DEFAULT_SHADE).find((l) => l.id === 'directional-0')!.strength).toBe(1);
  });

  it('turns its lights together, its key light to come from where it is turned', () => {
    const turned = tunedRig(rig, 1, [1, 0, 0]);
    // The key light (the brightest) shone along +y, so came from -y: now it comes from +x.
    turned.directional[0]!.direction.forEach((v, i) => expect(v).toBeCloseTo([-1, 0, 0][i]!, 6));
  });
});
