import { describe, expect, it } from 'vitest';
import { EMPTY_LIBRARY, type LibraryState, withLibrary } from '../library/library';
import type { SetPlanet } from '../planet-sets/planet-sets';
import type { PlanetChoices } from '../scenes/scene-settings';
import {
  sceneSwitched,
  switched,
  variantLayersOf,
  variantSettingsOf,
  variantsOf,
  variantsOnOf,
} from './variants';

const painted = {
  id: 'painted',
  name: 'Painted',
  settings: { materials: { surface: { lit: false } } },
};

describe('variants', () => {
  it("are a body's data's (with the library's changes to them), then those made in the editor", () => {
    const own = {
      variants: [
        { id: 'variant-1', name: 'Shield', settings: { overlaysEnabled: { nexus: true } } },
        { id: 'painted', name: 'Flat', settings: { shade: 0 } },
      ],
    };
    const variants = variantsOf([painted], own);
    expect(variants.map((v) => [v.id, v.name, v.made])).toEqual([
      ['painted', 'Flat', false],
      ['variant-1', 'Shield', true],
    ]);
    // The data's settings, then the library's changes to them.
    expect(variants[0]?.layers).toEqual([painted.settings, { shade: 0 }]);
    // Those on stack in the list's order, whatever order they were switched on in.
    expect(variantLayersOf(variants, ['variant-1', 'painted'])).toEqual([
      painted.settings,
      { shade: 0 },
      { overlaysEnabled: { nexus: true } },
    ]);
  });

  it("are on as the nearest level says, and switched on or off by a scene's variants that are on, in order", () => {
    expect(variantsOnOf({ variantsOn: ['a'] }, { variantsOn: ['b'] })).toEqual(['a']);
    expect(variantsOnOf(undefined, { variantsOn: ['b'] })).toEqual(['b']);
    expect(variantsOnOf({}, undefined)).toEqual([]);
    expect(switched(['a', 'b'], { a: false, c: true })).toEqual(['b', 'c']);
    const scene: PlanetChoices = {
      sceneVariants: [
        { id: 's1', name: 'Preview', switches: { '0': { lit: false, painted: true } } },
        {
          id: 's2',
          name: 'Shields',
          switches: { '0': { painted: false, shield: true }, '1': { shield: true } },
        },
      ],
      sceneVariantsOn: ['s1'],
    };
    expect(sceneSwitched(scene, '0', ['lit'])).toEqual(['painted']);
    expect(sceneSwitched(scene, '1', [])).toEqual([]); // s2 is off
    expect(sceneSwitched({ ...scene, sceneVariantsOn: ['s1', 's2'] }, '0', ['lit'])).toEqual([
      'shield',
    ]);
  });

  it("stack over a planet's own settings and under a scene's when it is drawn, and may switch its overlays", () => {
    const korhal: SetPlanet = { id: 'korhal', position: [0, 0, 0], radius: 1, overlays: ['nexus'] };
    const library: LibraryState = {
      ...EMPTY_LIBRARY,
      planets: {
        korhal: {
          shade: 0.5,
          turn: 10,
          overlaysEnabled: { nexus: false },
          variants: [
            {
              id: 'variant-1',
              name: 'Shield',
              settings: { overlaysEnabled: { nexus: true }, turn: 20 },
            },
          ],
          variantsOn: [],
        },
      },
      styles: { nexus: { shade: 0.9 } },
    };
    const plain = withLibrary(korhal, library, { variants: [painted] });
    expect(plain.overlays).toEqual([]); // the shield off, as the planet has it
    expect(plain.turn).toBe(10);
    const shielded = withLibrary({ ...korhal, variantsOn: ['variant-1', 'painted'] }, library, {
      variants: [painted],
    });
    expect(shielded.overlays).toEqual(['nexus']); // switched on by its variant
    expect(shielded.turn).toBe(20); // the variant's over its own
    expect(shielded.shade).toEqual({ strength: 0.5 }); // its own over the overlay's
    expect(shielded.materials?.['surface']).toEqual({ lit: false }); // the data's variant
    // On by default in the library; a scene's setting over all.
    const byDefault = {
      ...library,
      planets: { korhal: { ...library.planets['korhal'], variantsOn: ['variant-1'] } },
    };
    expect(withLibrary(korhal, byDefault).turn).toBe(20);
    expect(withLibrary({ ...korhal, variantsOn: ['variant-1'], turn: 5 }, library).turn).toBe(5);
  });

  it('draw an overlay its data switches off only where a level over the data switches it on', () => {
    const play: SetPlanet = { id: 'play-large', position: [0, 0, 0], radius: 1, overlays: ['nexus'] };
    const data = {
      overlaysEnabled: { nexus: false },
      variants: [{ id: 'nexus', settings: { overlaysEnabled: { nexus: true } } }],
    };
    expect(withLibrary(play, EMPTY_LIBRARY, data).overlays).toEqual([]);
    expect(withLibrary({ ...play, variantsOn: ['nexus'] }, EMPTY_LIBRARY, data).overlays).toEqual([
      'nexus',
    ]);
    const shown = { ...EMPTY_LIBRARY, planets: { 'play-large': { overlaysEnabled: { nexus: true } } } };
    expect(withLibrary(play, shown, data).overlays).toEqual(['nexus']);
    expect(withLibrary(play, EMPTY_LIBRARY).overlays).toEqual(['nexus']); // no data: drawn
  });

  it("take all of a body's changes but what is its own alone (its name, being drawn, what it can wear, its variants)", () => {
    const { variant, kept } = variantSettingsOf({
      label: 'Home',
      enabled: true,
      overlays: ['nexus'],
      overlaysEnabled: { nexus: false },
      variantsOn: ['painted'],
      shade: 0.4,
      materials: { clouds: { glow: 2 } },
    });
    expect(variant).toEqual({
      overlaysEnabled: { nexus: false },
      shade: 0.4,
      materials: { clouds: { glow: 2 } },
    });
    expect(kept).toEqual({
      label: 'Home',
      enabled: true,
      overlays: ['nexus'],
      variantsOn: ['painted'],
    });
    expect(variantSettingsOf({ shade: 0.4 }).kept).toBeUndefined();
  });
});
