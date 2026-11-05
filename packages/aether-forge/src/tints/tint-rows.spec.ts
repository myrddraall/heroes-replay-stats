import { describe, expect, it } from 'vitest';
import type { TintLayer } from '@myrddraall/heroes-replay-stats-aether/tints';
import { editedTints, tintRowsOf } from './tint-rows';

const warm: TintLayer = { id: 'warm', kind: 'colour', colour: '#ff8800', blend: 'multiply', strength: 1 };
const grey: TintLayer = { id: 'grey', kind: 'hsl', hue: 0, saturation: -1, lightness: 0, strength: 1 };
const own: TintLayer = { id: 'tint-1', kind: 'colour', colour: '#0000ff', blend: 'hue', strength: 0.5 };

describe("an object's tints as listed", () => {
  it('lists those added under the level edited first, with where, then its own', () => {
    const rows = tintRowsOf(
      [
        ['its tuning', { tints: [warm] }],
        ['the library (planet)', { tints: [grey], tintsEnabled: { warm: false } }],
      ],
      { tints: [own], tintsEnabled: { grey: false } },
    );
    expect(rows).toEqual([
      { tint: warm, from: 'its tuning', on: false, onBelow: false, switched: false },
      { tint: grey, from: 'the library (planet)', on: false, onBelow: true, switched: true },
      { tint: own, on: true, onBelow: true, switched: false },
    ]);
  });

  it('adds, changes, moves and takes out only the level’s own; nothing left, nothing set', () => {
    const rows = tintRowsOf([['its tuning', { tints: [warm] }]], { tints: [own] });
    const added = editedTints({ tints: [own] }, rows, { kind: 'add', tint: 'gradient' });
    expect(added?.tints?.map((t) => t.id)).toEqual(['tint-1', 'tint-2']);
    const moved = editedTints(added, rows, { kind: 'move', id: 'tint-2', to: 0 });
    expect(moved?.tints?.map((t) => t.id)).toEqual(['tint-2', 'tint-1']);
    const changed = editedTints({ tints: [own] }, rows, {
      kind: 'change',
      tint: { ...own, strength: 1 },
    });
    expect(changed?.tints?.[0]?.strength).toBe(1);
    expect(
      editedTints({ tints: [own], tintsEnabled: { 'tint-1': false } }, rows, {
        kind: 'remove',
        id: 'tint-1',
      }),
    ).toBeUndefined();
  });

  it('switches one added under it only where it differs from what is under it, its own only off', () => {
    const rows = tintRowsOf([['its tuning', { tints: [warm] }]], { tints: [own] });
    const off = editedTints({ tints: [own] }, rows, { kind: 'switch', id: 'warm', on: false });
    expect(off).toEqual({ tints: [own], tintsEnabled: { warm: false } });
    const back = editedTints(off, tintRowsOf([['its tuning', { tints: [warm] }]], off), {
      kind: 'switch',
      id: 'warm',
      on: true,
    });
    expect(back).toEqual({ tints: [own] });
    const ownOff = editedTints({ tints: [own] }, rows, { kind: 'switch', id: 'tint-1', on: false });
    expect(ownOff?.tintsEnabled).toEqual({ 'tint-1': false });
    expect(
      editedTints(ownOff, rows, { kind: 'switch', id: 'tint-1', on: true })?.tintsEnabled,
    ).toBeUndefined();
    expect(
      editedTints(off, rows, { kind: 'reset-switch', id: 'warm' })?.tintsEnabled,
    ).toBeUndefined();
  });
});
