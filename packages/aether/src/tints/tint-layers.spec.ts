import { describe, expect, it } from 'vitest';
import {
  drawnTints,
  KEPT_TINT,
  migrateTints,
  newTint,
  stackedTints,
  type TintLayer,
} from './tint-layers';
import { mergeMaterialSettings } from '../materials/material-settings';

const warm: TintLayer = { id: 'warm', kind: 'colour', colour: '#ff8800', blend: 'multiply', strength: 1 };
const grey: TintLayer = { id: 'grey', kind: 'hsl', hue: 0, saturation: -1, lightness: 0, strength: 0.5 };
const map: TintLayer = {
  id: 'map',
  kind: 'gradient',
  strength: 1,
  stops: [
    { at: 0, colour: '#000000' },
    { at: 1, colour: '#ffffff' },
  ],
};

describe('object tints', () => {
  it("join each level's after the ones under it, the nearer level's switches over the further's", () => {
    const stacked = stackedTints(
      { tints: [warm], tintsEnabled: { warm: false } },
      { tints: [grey] },
      { tints: [map], tintsEnabled: { warm: true, grey: false } },
    );
    expect(stacked.tints).toEqual([warm, grey, map]);
    expect(stacked.tintsEnabled).toEqual({ warm: true, grey: false });
    expect(stackedTints(undefined, {})).toEqual({});
  });

  it('draw those not switched off, in order, as many as a draw takes', () => {
    const set = { tints: [warm, grey, map], tintsEnabled: { grey: false } };
    expect(drawnTints(set, 8)).toEqual([warm, map]);
    expect(drawnTints(set, 1)).toEqual([warm]);
    expect(drawnTints(undefined, 8)).toEqual([]);
  });

  it("join across a material's levels too, its other settings the nearer's", () => {
    const merged = mergeMaterialSettings(
      { rock: { glow: 1, tints: [warm] } },
      { rock: { glow: 2, tints: [grey], tintsEnabled: { warm: false } } },
    )['rock'];
    expect(merged).toEqual({ glow: 2, tints: [warm, grey], tintsEnabled: { warm: false } });
  });

  it('start new ones with an id not taken', () => {
    expect(newTint('colour', []).id).toBe('tint-1');
    expect(newTint('hsl', ['tint-1', 'tint-2'])).toEqual({
      id: 'tint-3',
      kind: 'hsl',
      strength: 1,
      hue: 0,
      saturation: 0,
      lightness: 0,
    });
    expect(newTint('gradient', []).kind).toBe('gradient');
  });

  it('read the one tint kept before as the first of its list, wherever it is, and leave the rest alone', () => {
    const kept = { colour: '#ff0000', blend: 'color', strength: 0.5 };
    const design = {
      library: {
        planets: { korhal: { tint: kept, turn: 10 } },
        materials: { rock: { tint: kept, tints: [warm] } },
        sky: { tint: kept },
      },
      tints: { background: { on: true, colour: '#fff', blend: 'multiply' } },
    };
    const first = { id: KEPT_TINT, kind: 'colour', ...kept };
    expect(migrateTints(design)).toEqual({
      library: {
        planets: { korhal: { tints: [first], turn: 10 } },
        materials: { rock: { tints: [first, warm] } },
        sky: { tints: [first] },
      },
      tints: design.tints,
    });
    const now = { library: { planets: { korhal: { tints: [warm] } } } };
    expect(migrateTints(now)).toBe(now);
  });
});
