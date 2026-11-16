import type { ListRow } from './list-rows';

/** The keys that move between a list's items. */
export type ListMove = 'next' | 'previous' | 'down' | 'up' | 'first' | 'last';

/** The move a key makes, or null when it makes none. */
export function listMoveOf(key: string): ListMove | null {
  switch (key) {
    case 'ArrowRight':
      return 'next';
    case 'ArrowLeft':
      return 'previous';
    case 'ArrowDown':
      return 'down';
    case 'ArrowUp':
      return 'up';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return null;
  }
}

/**
 * The item a move from `index` lands on, among the items `rows` lay out: next and previous step
 * one item, down and up go to the same column of the next or previous row of items (its last
 * item when that row is shorter), first and last to the ends.
 */
export function listMove(rows: readonly ListRow[], count: number, index: number, move: ListMove): number {
  if (count === 0) return -1;
  const clamp = (i: number) => Math.min(count - 1, Math.max(0, i));
  switch (move) {
    case 'next':
      return clamp(index + 1);
    case 'previous':
      return clamp(index - 1);
    case 'first':
      return 0;
    case 'last':
      return count - 1;
  }
  const itemRows = rows.filter((r) => r.kind === 'items');
  const at = itemRows.findIndex((r) => index >= r.start && index < r.start + r.count);
  if (at < 0) return clamp(index);
  const to = itemRows[move === 'down' ? at + 1 : at - 1];
  if (!to) return index;
  return to.start + Math.min(index - itemRows[at]!.start, to.count - 1);
}

/** The row of items `index` is drawn in. */
export function rowOfItem(rows: readonly ListRow[], index: number): number {
  return rows.findIndex((r) => r.kind === 'items' && index >= r.start && index < r.start + r.count);
}
