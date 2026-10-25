import { describe, expect, it } from 'vitest';
import {
  EMPTY_LIBRARY,
  type LibraryState,
  skyWithLibrary,
  skyWornOf,
  withLibrary,
} from './background-design';
import type { SetPlanet } from './planet-sets';

const korhal: SetPlanet = { id: 'korhal', position: [0, 0, 0], radius: 1 };
const red = { colour: '#ff0000', blend: 'color', strength: 1 } as const;
const blue = { colour: '#0000ff', blend: 'hue', strength: 0.5 } as const;

describe('withLibrary', () => {
  it('leaves a planet the library has nothing for as it is', () => {
    expect(withLibrary(korhal, EMPTY_LIBRARY)).toBe(korhal);
  });

  it("turns a planet as the scene says, over the library's, its axis likewise", () => {
    const library: LibraryState = {
      ...EMPTY_LIBRARY,
      planets: { korhal: { orientation: 'world', axis: [0, 0.2, 1] } },
    };
    expect(withLibrary(korhal, library)).toMatchObject({ orientation: 'world', axis: [0, 0.2, 1] });
    const set = withLibrary({ ...korhal, orientation: 'camera', axis: [1, 0, 0] }, library);
    expect(set).toMatchObject({ orientation: 'camera', axis: [1, 0, 0] });
    // Set nowhere: not given at all (the renderer's default, facing the camera).
    const none = withLibrary(korhal, { ...EMPTY_LIBRARY, planets: { korhal: { tint: red } } });
    expect(none).not.toHaveProperty('orientation');
    expect(none).not.toHaveProperty('axis');
  });

  it("puts the planet's and its style's defaults under what is set for it", () => {
    const library: LibraryState = {
      planets: {
        korhal: {
          lighting: 0.5,
          tint: red,
          shade: 0.3,
          materials: { rock: { strength: 0.2, glow: 1 } },
        },
      },
      styles: { nexus: { shadeTowards: [1, 0, 0], materials: { shield: { glow: 2 } } } },
      sky: {},
    };
    const shown = withLibrary(
      { ...korhal, overlays: ['nexus'], tint: blue, materials: { rock: { strength: 0.9 } } },
      library,
    );
    expect(shown.lighting).toBe(0.5);
    expect(shown.tint).toEqual(blue);
    expect(shown.materials).toEqual({ rock: { strength: 0.9, glow: 1 }, shield: { glow: 2 } });
    expect(shown.shade).toEqual({ strength: 0.3, direction: [1, 0, 0] });
  });

  it('draws a planet whose overlay is switched off as if it wore none (the scene over the library)', () => {
    const library: LibraryState = {
      planets: { korhal: { overlayEnabled: false } },
      styles: { nexus: { shade: 0.8, added: [{ id: 'added-x', kind: 'ambient', name: 'Glow' }] } },
      sky: {},
    };
    const off = withLibrary({ ...korhal, overlays: ['nexus'] }, library);
    expect(off.overlays).toEqual([]);
    expect(off.added).toEqual([]);
    expect(off.shade).toEqual({});
    const on = withLibrary({ ...korhal, overlays: ['nexus'], overlayEnabled: true }, library);
    expect(on.overlays).toEqual(['nexus']);
    expect(on.added).toHaveLength(1);
  });

  it("lets a style's shade win over the planet's own", () => {
    const library: LibraryState = {
      planets: { korhal: { shade: 0.3 } },
      styles: { nexus: { shade: 0.8 } },
      sky: {},
    };
    expect(withLibrary({ ...korhal, overlays: ['nexus'] }, library).shade).toEqual({
      strength: 0.8,
    });
  });

  it('stacks the overlays a planet wears, the later over the earlier, each switched on its own', () => {
    const library: LibraryState = {
      planets: { korhal: { overlaysEnabled: { clouds: false } } },
      styles: {
        nexus: { shade: 0.8, materials: { grid: { glow: 2 } }, order: ['grid'] },
        clouds: { shade: 0.2, materials: { grid: { glow: 5 } }, order: ['puff'] },
        rings: { materials: { band: { strength: 0.5 } }, order: ['band'] },
      },
      sky: {},
    };
    const worn = withLibrary({ ...korhal, overlays: ['nexus', 'clouds', 'rings'] }, library);
    expect(worn.overlays).toEqual(['nexus', 'rings']); // clouds switched off in the library
    expect(worn.materials).toEqual({ grid: { glow: 2 }, band: { strength: 0.5 } });
    expect(worn.order).toEqual(['grid', 'band']);
    const scene = withLibrary(
      { ...korhal, overlays: ['nexus', 'clouds'], overlaysEnabled: { clouds: true } },
      library,
    );
    expect(scene.overlays).toEqual(['nexus', 'clouds']); // the scene over the library
    expect(scene.materials?.['grid']).toEqual({ glow: 5 });
    expect(scene.shade).toEqual({ strength: 0.2 });
  });
});

describe('the material cascade', () => {
  it("puts a material's base under a planet's own setting of it, and the scene's over both", () => {
    const library: LibraryState = {
      materials: { rock: { strength: 0.2, glow: 1, scale: 2 } },
      planets: { korhal: { materials: { rock: { glow: 3 } } } },
      styles: {},
      sky: { materials: { rock: { scale: 4 } } },
    };
    expect(
      withLibrary({ ...korhal, materials: { rock: { strength: 0.9 } } }, library).materials,
    ).toEqual({ rock: { strength: 0.9, glow: 3, scale: 2 } });
    expect(withLibrary({ ...korhal, id: 'azeroth' }, library).materials).toEqual({
      rock: { strength: 0.2, glow: 1, scale: 2 },
    });
    expect(skyWithLibrary(undefined, library).materials).toEqual({
      rock: { strength: 0.2, glow: 1, scale: 4 },
    });
  });
});

describe('skyWithLibrary', () => {
  it("puts the library's sky under a scene's", () => {
    const library: LibraryState = {
      ...EMPTY_LIBRARY,
      sky: { materials: { stars: { strength: 0.4, glow: 1 } }, tint: red },
    };
    expect(skyWithLibrary({ materials: { stars: { strength: 1 } } }, library)).toMatchObject({
      materials: { stars: { strength: 1, glow: 1 } },
      tint: red,
    });
    expect(skyWithLibrary({ tint: blue }, library).tint).toEqual(blue);
    expect(skyWithLibrary(undefined, library).tint).toEqual(red);
  });

  it("wears its data's overlays unless set, each switched on its own, their settings the library's", () => {
    const library: LibraryState = {
      ...EMPTY_LIBRARY,
      styles: {
        horizon: {
          materials: { energy: { strength: 0.5 } },
          parts: { 'style:horizon:band': { size: 2 } },
        },
      },
      sky: { overlaysEnabled: { aurora: false } },
    };
    const wears = ['horizon', 'aurora'];
    const shown = skyWithLibrary(undefined, library, wears);
    expect(shown.overlays).toEqual(['horizon']); // aurora switched off in the library
    expect(shown.materials).toEqual({ energy: { strength: 0.5 } });
    expect(shown.parts).toEqual({ 'style:horizon:band': { size: 2 } });
    // A scene's own choice, over the data's and the library's.
    const scene = skyWithLibrary(
      {
        overlays: ['aurora'],
        overlaysEnabled: { aurora: true },
        materials: { energy: { glow: 2 } },
      },
      library,
      wears,
    );
    expect(scene.overlays).toEqual(['aurora']);
    expect(scene.materials).toEqual({ energy: { glow: 2 } }); // horizon's settings only where worn
    // One made in the editor that is no longer there: as if it never was.
    expect(skyWornOf({ overlays: ['@overlay-9', 'horizon'] }, library)).toEqual(['horizon']);
  });
});
