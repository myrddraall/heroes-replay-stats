import { describe, expect, it } from 'vitest';
import type { PlanetFile } from "@myrddraall/heroes-replay-stats-aether/formats";
import {
  buildStandIn,
  parseStandIn,
  STAND_IN_MATERIAL,
  standInId,
  standInLightSettings,
  standInLights,
  withStandInLight,
} from './stand-in';

const owner = {
  kind: 'world',
  parts: [
    {
      role: 'surface',
      shape: { kind: 'sphere', radius: 1, side: 'near' },
      mapping: { kind: 'linear', u: [1, 0, 0, 0], v: [0, 1, 0, 0] },
      materials: ['ground', 'haze'],
    },
    {
      role: 'shell',
      shape: { kind: 'sphere', radius: 1.2, side: 'far' },
      mapping: { kind: 'linear', u: [1, 0, 0, 0], v: [0, 1, 0, 0] },
      materials: ['haze'],
    },
  ],
  materials: {
    ground: {
      blend: 'opaque',
      unshaded: false,
      vertexAlpha: false,
      vertexColor: false,
      emissiveMult: 1,
      diffuse: { texture: 'rock', brightMult: 1 },
      emissive: null,
      alphaMasks: [],
    },
    haze: {
      blend: 'add',
      unshaded: true,
      vertexAlpha: false,
      vertexColor: false,
      emissiveMult: 1,
      diffuse: { texture: 'mist', brightMult: 1 },
      emissive: null,
      alphaMasks: [],
    },
  },
  textures: {
    rock: { file: 'rock.webp', width: 8, height: 8 },
    mist: { file: 'mist.webp', width: 8, height: 8 },
  },
  tuning: { materials: { haze: { strength: 0.4 } } },
} as const satisfies PlanetFile;

describe('the stand-in planet', () => {
  it('reads back the id it is given', () => {
    const spec = { fill: 'grid', cells: 32, owner: 'korhal', material: 'haze' } as const;
    expect(parseStandIn(standInId(spec))).toEqual(spec);
    expect(parseStandIn(standInId({ fill: 'colour', cells: 16 }))).toEqual({
      fill: 'colour',
      cells: 16,
      owner: undefined,
      material: undefined,
    });
    expect(parseStandIn('korhal')).toBeNull();
  });

  it('is a plain lit sphere of a colour', () => {
    const built = buildStandIn({ fill: 'colour', cells: 32 }, {})!;
    expect(built.label).toBe('Stand-in');
    expect(built.planet.parts.map((p) => p.materials)).toEqual([[STAND_IN_MATERIAL]]);
    expect(built.planet.materials[STAND_IN_MATERIAL]?.diffuse?.color).toEqual([255, 255, 255, 255]);
    expect(built.planet.light?.directional).toHaveLength(1);
    expect(built.images).toBeUndefined();
  });

  it('carries a grid texture it makes itself', () => {
    const built = buildStandIn({ fill: 'grid', cells: 32 }, {})!;
    const layer = built.planet.materials[STAND_IN_MATERIAL]?.diffuse;
    expect(layer?.tiling).toEqual([16, 8]);
    expect(Object.keys(built.images ?? {})).toEqual([layer?.texture]);
  });

  it('draws a material over it on the parts of its own file that draw it', () => {
    const built = buildStandIn(
      { fill: 'colour', cells: 32, owner: 'korhal', material: 'haze' },
      { korhal: owner },
    )!;
    const [surface, ...over] = built.planet.parts;
    expect(surface?.materials).toEqual([STAND_IN_MATERIAL]);
    expect(over.map((p) => [p.role, p.materials, p.shape])).toEqual([
      ['layer', ['haze'], { kind: 'sphere', radius: 1.002, side: 'near' }],
      ['shell', ['haze'], { kind: 'sphere', radius: 1.2, side: 'far' }],
    ]);
    expect(Object.keys(built.planet.textures)).toEqual(['mist']);
    expect(built.planet.tuning).toEqual({ materials: { haze: { strength: 0.4 } } });
  });

  it("isn't made while the material's file isn't there", () => {
    expect(
      buildStandIn({ fill: 'grid', cells: 32, owner: 'korhal', material: 'haze' }, {}),
    ).toBeUndefined();
  });

  it('is lit by its own lights: evenly from all round, its directional light switched off', () => {
    const lights = standInLights({});
    expect(lights.map((l) => [l.light.id, l.light.name, l.light.enabled])).toEqual([
      ['ambient', 'Ambient light', true],
      ['directional-0', 'Directional light', false],
    ]);
    const ambient = lights[0]!.light;
    expect([ambient.colour, ambient.strength]).toEqual(['#ffffff', 1]);
    // An editing aid's: nothing to link, nothing to take away.
    expect(lights.every((l) => !l.removable && !l.receivers.length)).toBe(true);
    expect(standInLightSettings({})).toEqual({ 'directional-0': { enabled: false } });
    // Switched on (as set) over how it starts; renamed.
    const set = { 'directional-0': { enabled: true, name: 'Relief' } } as const;
    expect(standInLightSettings(set)['directional-0']).toEqual(set['directional-0']);
    expect(standInLights(set)[1]!.light).toMatchObject({ enabled: true, name: 'Relief' });
    expect(standInLights(set)[1]!.nameBelow).toBe('Directional light');
  });

  it('keeps only what differs from how its lights start', () => {
    const on = withStandInLight({}, 'directional-0', { enabled: true });
    expect(on).toEqual({ 'directional-0': { enabled: true } });
    // Switched off again: as it starts, so nothing set.
    expect(withStandInLight(on, 'directional-0', { enabled: false })).toEqual({});
    // The ambient light starts on: switched on is nothing set; switched off is.
    expect(withStandInLight({}, 'ambient', { enabled: true })).toEqual({});
    const dim = withStandInLight({}, 'ambient', { strength: 0.5, colour: '#ff0000' });
    expect(withStandInLight(dim, 'ambient', {}, ['colour'])).toEqual({
      ambient: { strength: 0.5 },
    });
    expect(withStandInLight({ ...dim, ...on }, 'ambient', {}, 'all')).toEqual(on);
  });
});
