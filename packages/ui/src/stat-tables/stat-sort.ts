import type { StatRow } from './stat-column';

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

/** A column header's `aria-sort`: how the table is sorted by it, null when it is not. */
export function statAriaSort(
  sort: StatSort | null,
  column: string,
): 'ascending' | 'descending' | null {
  if (sort?.column !== column) return null;
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}
