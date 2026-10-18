import { describe, expect, it } from 'vitest';
import { EMPTY_LIBRARY, type LibraryState, skyWithLibrary, withLibrary } from './background-design';
import type { SetPlanet } from './planet-sets';

const korhal: SetPlanet = { id: 'korhal', position: [0, 0, 0], radius: 1 };
const red = { colour: '#ff0000', blend: 'color', strength: 1 } as const;
const blue = { colour: '#0000ff', blend: 'hue', strength: 0.5 } as const;

describe('withLibrary', () => {
  it('leaves a planet the library has nothing for as it is', () => {
    expect(withLibrary(korhal, EMPTY_LIBRARY)).toBe(korhal);
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
      { ...korhal, style: 'nexus', tint: blue, materials: { rock: { strength: 0.9 } } },
      library,
    );
    expect(shown.lighting).toBe(0.5);
    expect(shown.tint).toEqual(blue);
    expect(shown.materials).toEqual({ rock: { strength: 0.9, glow: 1 }, shield: { glow: 2 } });
    expect(shown.shade).toEqual({ strength: 0.3, direction: [1, 0, 0] });
  });

  it("lets a style's shade win over the planet's own", () => {
    const library: LibraryState = {
      planets: { korhal: { shade: 0.3 } },
      styles: { nexus: { shade: 0.8 } },
      sky: {},
    };
    expect(withLibrary({ ...korhal, style: 'nexus' }, library).shade).toEqual({ strength: 0.8 });
  });
});

describe('skyWithLibrary', () => {
  it("puts the library's sky under a scene's", () => {
    const library: LibraryState = {
      ...EMPTY_LIBRARY,
      sky: { materials: { stars: { strength: 0.4, glow: 1 } }, tint: red },
    };
    expect(skyWithLibrary({ materials: { stars: { strength: 1 } } }, library)).toEqual({
      materials: { stars: { strength: 1, glow: 1 } },
      tint: red,
    });
    expect(skyWithLibrary({ tint: blue }, library).tint).toEqual(blue);
    expect(skyWithLibrary(undefined, library).tint).toEqual(red);
  });
});
