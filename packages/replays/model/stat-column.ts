import type { TeamColor } from './team-color';
/**
 * How a stat's numbers read: a count, a number with decimals, a share, a length of time in
 * seconds, or a moment on the game clock in seconds (`m:ss`).
 */
export type StatFormat = 'integer' | 'decimal' | 'percent' | 'duration' | 'clock';

/** How far the data behind a stat can be trusted: all of it, some players, a flawed figure, none. */
export type StatSupport = 'full' | 'partial' | 'flawed' | 'none';

/**
 * A stat's icon as the game's score screen draws its sort buttons (GameStatsPanel's SortButtons):
 * a sheet's picture (`score-screen#kills`) for each state, hovered and sorted by.
 */
export interface StatIcon {
  readonly normal: string;
  readonly hover: string;
  readonly sorted: string;
}

/** A stat's icon from a sheet's picture and its `-hover` and `-sorted` siblings. */
export function statIcon(picture: string): StatIcon {
  return { normal: picture, hover: `${picture}-hover`, sorted: `${picture}-sorted` };
}

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
  /** The game's icon the score table shows in place of the label. */
  readonly icon?: StatIcon;
  /** Full when absent. */
  readonly support?: StatSupport;
  /** What to know about the figure (why it is partial or flawed). */
  readonly notes?: readonly string[];
}

/** One row of a stat table: its values by column id and what its row head shows (`data`). */
/**
 * A stats row's theme: its team's colour, or the user's own row's, which still says their side
 * (`blue-self`: the blue team's grounds in green; `red-self`: the red team's in gold, as the game draws your row).
 */
export type StatRowTheme = TeamColor | 'blue-self' | 'red-self';

/** The theme for a team's colour: the user's own (`blue-self`, `red-self`) for them, else the team's. */
export function playerTheme(color: TeamColor, self: boolean): StatRowTheme {
  return self ? `${color}-self` : color;
}

export interface StatRow<T> {
  readonly key: string | number;
  /** Rows with the same group (a team) are compared with each other for the best in the group. */
  readonly group: string | number | null;
  readonly values: Readonly<Record<string, number | null | undefined>>;
  /** The row's theme (`theme`): its team's, or the user's own on their side. */
  readonly theme?: StatRowTheme;
  readonly data: T;
}

/** A column in a choice of columns: in its place in the order, shown or hidden. */
export interface StatColumnChoice {
  readonly id: string;
  readonly shown: boolean;
}
