/** How a stat's numbers read: a count, a number with decimals, a share or a time in seconds. */
export type StatFormat = 'integer' | 'decimal' | 'percent' | 'duration';

/** How far the data behind a stat can be trusted: all of it, some players, a flawed figure, none. */
export type StatSupport = 'full' | 'partial' | 'flawed' | 'none';

/** One stat as a table column. */
export interface StatColumn {
  /** The key of the stat in each row's `values`. */
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly format: StatFormat;
  /** Fraction digits, `[min, max]`; the format's own otherwise. */
  readonly digits?: readonly [number, number];
  /** Which way is better, for marking the best; no marking without it. */
  readonly better?: 'higher' | 'lower';
  /** A Material Symbols icon the score table shows in place of the label. */
  readonly icon?: string;
  /** Full when absent. */
  readonly support?: StatSupport;
  /** What to know about the figure (why it is partial or flawed). */
  readonly notes?: readonly string[];
}

/** One row of a stat table: its values by column id and what its row head shows (`data`). */
export interface StatRow<T> {
  readonly key: string | number;
  /** Rows with the same group (a team) are compared with each other for the best in the group. */
  readonly group: string | number | null;
  readonly values: Readonly<Record<string, number | null | undefined>>;
  /** Classes for the row, such as a team's theme. */
  readonly class?: string;
  readonly data: T;
}

/** A column in a choice of columns: in its place in the order, shown or hidden. */
export interface StatColumnChoice {
  readonly id: string;
  readonly shown: boolean;
}
