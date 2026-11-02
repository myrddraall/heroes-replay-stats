import type { StatColumn, StatRow } from '../../model';

/** A stat table's order: by one column, highest or lowest first. */
export interface StatSort {
  readonly column: string;
  readonly direction: 'asc' | 'desc';
}

/** The order after a column's header is pressed: highest first, then lowest first, then unsorted. */
export function nextStatSort(current: StatSort | null, column: string): StatSort | null {
  if (current?.column !== column) return { column, direction: 'desc' };
  return current.direction === 'desc' ? { column, direction: 'asc' } : null;
}

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

/** A column header's `aria-sort`: how the table is sorted by it, null when it is not. */
export function statAriaSort(
  sort: StatSort | null,
  column: string,
): 'ascending' | 'descending' | null {
  if (sort?.column !== column) return null;
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}
