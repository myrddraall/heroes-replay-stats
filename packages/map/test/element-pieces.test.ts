import { describe, expect, it } from 'vitest';
import type { ElementCut } from '../src/lib/pack/map-pack';
import {
  HIT_ALPHA,
  nextState,
  pieceAt,
  piecesOf,
  standingMasks,
  type HitImage,
} from '../src/lib/layers/elements/element-pieces';
import { fixturePack } from './fixtures';

const elements = fixturePack('battlefield-of-eternity').data.elements!;

describe('piecesOf', () => {
  const pieces = piecesOf(elements);

  it('lists every structure and camp once, further north first', () => {
    expect(pieces).toHaveLength(elements.structures.length + elements.camps.length);
    expect(new Set(pieces.map((p) => p.key)).size).toBe(pieces.length);
    for (let k = 1; k < pieces.length; k++) {
      expect(pieces[k - 1]!.cell[1]).toBeGreaterThanOrEqual(pieces[k]!.cell[1]);
    }
  });

  it("finds a piece by its first state's picture, the standing structure, not its rubble", () => {
    const structure = pieces.find((p) => p.kind === 'structure' && p.states['rubble'])!;
    expect(structure.hit).toBe(structure.states['standing']);
    const camp = pieces.find((p) => p.kind === 'camp')!;
    expect(camp.hit).toBe(camp.states['spawned']);
  });
});

describe('nextState', () => {
  it('steps through a kind, back to the first after the last', () => {
    expect(nextState('structure', 'standing')).toBe('rubble');
    expect(nextState('structure', 'rubble')).toBe('off');
    expect(nextState('structure', 'off')).toBe('standing');
    expect(nextState('camp', 'spawned')).toBe('off');
    expect(nextState('camp', 'off')).toBe('spawned');
  });
});

describe('standingMasks', () => {
  it("erases only where a neighbour that's standing too is in front", () => {
    const structure = elements.structures.find((s) => s.states.standing?.hiddenBy?.length)!;
    const cut = structure.states.standing!;
    const [first, ...others] = cut.hiddenBy!;
    expect(standingMasks(cut, () => true)).toEqual(cut.hiddenBy);
    expect(standingMasks(cut, (id) => id !== first!.id)).toEqual(others);
    expect(standingMasks({ file: 'x', rect: [0, 0, 1, 1] }, () => true)).toEqual([]);
  });
});

describe('pieceAt', () => {
  // two overlapping 10 × 10 pictures; the second is drawn last, so it is in front
  const cut = (left: number): ElementCut => ({ file: `${left}.webp`, rect: [left, 0, 10, 10] });
  const back = {
    key: 'back',
    kind: 'structure',
    id: 1,
    cell: [0, 2],
    states: {},
    hit: cut(0),
  } as const;
  const front = {
    key: 'front',
    kind: 'structure',
    id: 2,
    cell: [0, 1],
    states: {},
    hit: cut(5),
  } as const;
  // the front one is see-through on its left half
  const image = (c: ElementCut): HitImage => {
    const alpha = new Uint8Array(100).map((_, i) => (c === front.hit && i % 10 < 5 ? 0 : 255));
    return { width: 10, height: 10, alpha };
  };

  it('finds the nearest piece drawn whose picture is opaque there', () => {
    expect(pieceAt([back, front], 12, 5, image)?.key).toBe('front');
    expect(pieceAt([back, front], 7, 5, image)?.key).toBe('back'); // front see-through there
    expect(pieceAt([back, front], 20, 5, image)).toBeNull();
  });

  it("doesn't find a piece whose picture hasn't loaded, or is too faint", () => {
    expect(pieceAt([back, front], 2, 5, () => undefined)).toBeNull();
    const faint = () => ({ width: 10, height: 10, alpha: new Uint8Array(100).fill(HIT_ALPHA - 1) });
    expect(pieceAt([back], 2, 5, faint)).toBeNull();
  });
});
