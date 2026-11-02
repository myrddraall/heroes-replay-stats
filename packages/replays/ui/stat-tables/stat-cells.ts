import type { StatColumn, StatRow } from '../../model';
import { formatStat, formatStatCompact } from './stat-format';
import { sortStatRows, type StatSort } from './stat-sort';

/** One cell as a table draws it. */
export interface StatCell {
  readonly column: string;
  readonly text: string;
  /** The text in short form, for tight spaces (`89.3K`). */
  readonly compactText: string;
  /** The best value of its column in the table. */
  readonly best: boolean;
  /** The best value of its column in its row's group. */
  readonly bestInGroup: boolean;
}

/** One row as a table draws it: the row and its cells, in column order. */
export interface StatTableRow<T> {
  readonly row: StatRow<T>;
  readonly cells: readonly StatCell[];
}

function isBetter(value: number, than: number, better: 'higher' | 'lower'): boolean {
  return better === 'higher' ? value > than : value < than;
}

type Group = StatRow<unknown>['group'];

/** The best of some values, or null when they don't differ (no one stands out, as all zeros). */
class Best {
  private best: number | null = null;
  private differ = false;
  constructor(private readonly better: 'higher' | 'lower') {}

  add(value: number): void {
    if (this.best !== null && value !== this.best) this.differ = true;
    if (this.best === null || isBetter(value, this.best, this.better)) this.best = value;
  }

  get value(): number | null {
    return this.differ ? this.best : null;
  }
}

/** The best value in each column that has `better`, over all the rows and per group. */
function bestValues<T>(
  rows: readonly StatRow<T>[],
  columns: readonly StatColumn[],
): Map<string, { all: number | null; groups: Map<Group, number | null> }> {
  const best = new Map<string, { all: number | null; groups: Map<Group, number | null> }>();
  for (const column of columns) {
    const { better } = column;
    if (!better) continue;
    const all = new Best(better);
    const groups = new Map<Group, Best>();
    for (const row of rows) {
      const value = row.values[column.id];
      if (value === null || value === undefined) continue;
      all.add(value);
      let group = groups.get(row.group);
      if (!group) groups.set(row.group, (group = new Best(better)));
      group.add(value);
    }
    best.set(column.id, {
      all: all.value,
      groups: new Map([...groups].map(([g, b]) => [g, b.value])),
    });
  }
  return best;
}

/**
 * The rows in `sort`'s order with their cells formatted, and, where `markBest`, each column's best
 * values marked (ties are all best; a column where everyone has the same has none).
 */
export function statTableRows<T>(
  rows: readonly StatRow<T>[],
  columns: readonly StatColumn[],
  sort: StatSort | null,
  locale: string,
  markBest: boolean,
): readonly StatTableRow<T>[] {
  const best = markBest ? bestValues(rows, columns) : new Map();
  return sortStatRows(rows, sort).map((row) => ({
    row,
    cells: columns.map((column): StatCell => {
      const value = row.values[column.id];
      const b = best.get(column.id);
      return {
        column: column.id,
        text: formatStat(value, column, locale),
        compactText: formatStatCompact(value, column, locale),
        best: b?.all != null && value === b.all,
        bestInGroup:
          row.group !== null &&
          b?.groups.get(row.group) != null &&
          value === b.groups.get(row.group),
      };
    }),
  }));
}
