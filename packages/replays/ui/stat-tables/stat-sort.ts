import type { GridSort } from '@myrddraall/heroes-replay-stats-data-views/model';
import type { StatColumn, StatRow } from '../../model';

/** A stat table's order: by one column, highest or lowest first (the data grid's order). */
export type StatSort = GridSort;

/** The rows in `sort`'s order, rows without a value last; in their own order when unsorted. */
export function sortStatRows<T>(
  rows: readonly StatRow<T>[],
  sort: StatSort | null,
): readonly StatRow<T>[] {
  if (!sort) return rows;
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a.values[sort.column] ?? null;
    const y = b.values[sort.column] ?? null;
    if (x === null) return y === null ? 0 : 1;
    if (y === null) return -1;
    return (x - y) * sign;
  });
}

/** The order by a column with its best first: lowest first where lower is better, else highest. */
export function statBestFirst(column: Pick<StatColumn, 'id' | 'better'>): StatSort {
  return { column: column.id, direction: column.better === 'lower' ? 'asc' : 'desc' };
}

/**
 * The sort after a press on `column`, as a table's header cycles: best first on a new column, then
 * worst first, then unsorted.
 */
export function nextStatSort(
  current: StatSort | null,
  column: Pick<StatColumn, 'id' | 'better'>,
): StatSort | null {
  const best = statBestFirst(column);
  if (current?.column !== column.id) return best;
  if (current.direction === best.direction) {
    return { column: column.id, direction: best.direction === 'asc' ? 'desc' : 'asc' };
  }
  return null;
}

/**
 * Each row's place in a ranking by `column`, for rows already in that order: rows with the same
 * value share a place and the next one skips ahead (1, 1, 3).
 */
export function statRanks<T>(rows: readonly StatRow<T>[], column: string): readonly number[] {
  const ranks: number[] = [];
  rows.forEach((row, i) => {
    const value = row.values[column] ?? null;
    const shared = i > 0 && value !== null && value === (rows[i - 1].values[column] ?? null);
    ranks.push(shared ? ranks[i - 1] : i + 1);
  });
  return ranks;
}
