import { describe, expect, it } from 'vitest';
import { EMPTY_SCENES } from './background-design';
import {
  chosenOverlays,
  migrateDesign,
  overlayFile,
  overlayOfFile,
  overlayOn,
  wornKey,
} from './overlays';

describe('overlays', () => {
  it('reads what a body chose to wear, one kept before bodies wore several as the list of it', () => {
    expect(chosenOverlays({ overlays: ['nexus', 'clouds'] })).toEqual(['nexus', 'clouds']);
    expect(chosenOverlays({ style: 'nexus' })).toEqual(['nexus']);
    expect(chosenOverlays({ style: '' })).toEqual([]);
    expect(chosenOverlays({})).toBeUndefined();
  });

  it('keeps settings for one overlay under the same key as before', () => {
    expect(wornKey([])).toBe('');
    expect(wornKey(['nexus'])).toBe('nexus');
    expect(wornKey(['nexus', 'clouds'])).toBe('nexus+clouds');
  });

  it("loads the game data's overlays from their style files, and one made in the editor by its revision", () => {
    expect(overlayFile('nexus')).toBe('style-nexus');
    expect(overlayOfFile('style-nexus')).toBe('nexus');
    expect(overlayFile('@overlay-1', 'abc')).toBe('@overlay-1#abc');
    expect(overlayOfFile('@overlay-1#abc')).toBe('@overlay-1');
  });

  it('switches an overlay by its own switch, else one kept for all, from the nearest level down', () => {
    expect(
      overlayOn('nexus', { overlaysEnabled: { nexus: false } }, { overlayEnabled: true }),
    ).toBe(false);
    expect(overlayOn('nexus', undefined, { overlayEnabled: false })).toBe(false);
    expect(overlayOn('nexus', {}, {})).toBeUndefined();
  });

  it("reads parts named by their role alone as the overlay's they were set for", () => {
    const reach = { mode: 'only', receivers: ['part:style:shield', 'material:grid'] } as const;
    const design = migrateDesign({
      library: {
        planets: {
          'play-large': { parts: { 'style:ring': { size: 2 }, 'own:surface': {} } as never },
        },
        styles: {
          nexus: {
            parts: { 'style:shield': { size: 1.1 } } as never,
            added: [{ id: 'added-1', kind: 'shadow', name: 'Antilight', reach }],
          },
        },
        sky: {},
      },
      scenes: {
        ...EMPTY_SCENES,
        planets: {
          s: {
            bodies: [
              {
                id: 'korhal',
                position: [0, 0, 0],
                radius: 1,
                variants: { nexus: { lights: { shadow: { reach } } }, '': {} },
                moons: [
                  {
                    id: 'planet-1',
                    orbit: { radius: 2, tilt: 0, turn: 0, progress: 0, size: 0.2 },
                    settings: { parts: { 'style:shield': { enabled: false } } as never },
                  },
                ],
              },
            ],
          },
        },
      },
    });
    expect(design.library.planets['play-large']?.parts).toEqual({
      'style:nexus:ring': { size: 2 },
      'own:surface': {},
    });
    expect(design.library.styles['nexus']?.parts).toEqual({ 'style:nexus:shield': { size: 1.1 } });
    expect(design.library.styles['nexus']?.added?.[0]?.reach?.receivers).toEqual([
      'part:style:nexus:shield',
      'material:grid',
    ]);
    const body = design.scenes.planets['s']?.bodies?.[0];
    expect(body?.variants?.['nexus']?.lights?.shadow?.reach?.receivers[0]).toBe(
      'part:style:nexus:shield',
    );
    expect(body?.moons?.[0]?.settings?.parts).toEqual({ 'style:nexus:shield': { enabled: false } });
    // Kept since: as it is.
    expect(migrateDesign(design)).toEqual(design);
  });
});
