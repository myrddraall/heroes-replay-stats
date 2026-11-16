import { describe, expect, it } from 'vitest';
import { listMove, listMoveOf, rowOfItem } from './list-moves';
import { listRows } from './list-rows';

describe('listMove', () => {
  // 7 items, 3 a row, two groups: a (0..3) and b (4..6)
  const rows = listRows(7, 3, (i) => (i < 4 ? 'a' : 'b'));

  it('steps one item, and to the ends', () => {
    expect(listMove(rows, 7, 2, 'next')).toBe(3);
    expect(listMove(rows, 7, 0, 'previous')).toBe(0);
    expect(listMove(rows, 7, 6, 'next')).toBe(6);
    expect(listMove(rows, 7, 3, 'first')).toBe(0);
    expect(listMove(rows, 7, 3, 'last')).toBe(6);
  });

  it('goes to the same column of the next or previous row of items, across groups', () => {
    // rows of items: [0 1 2] [3] [4 5 6]
    expect(listMove(rows, 7, 2, 'down')).toBe(3);
    expect(listMove(rows, 7, 3, 'down')).toBe(4);
    expect(listMove(rows, 7, 6, 'up')).toBe(3);
    expect(listMove(rows, 7, 1, 'up')).toBe(1);
    expect(listMove(rows, 7, 5, 'down')).toBe(5);
  });

  it('maps the keys, and finds the row an item is in', () => {
    expect(['ArrowDown', 'End', 'Tab'].map(listMoveOf)).toEqual(['down', 'last', null]);
    expect(rowOfItem(rows, 3)).toBe(2);
    expect(rowOfItem(rows, 5)).toBe(4);
  });
});
