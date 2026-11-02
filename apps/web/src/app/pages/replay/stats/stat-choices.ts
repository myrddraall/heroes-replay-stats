import type { StatColumnChoice } from '@myrddraall/heroes-replay-stats-replays/ui';

/**
 * A section's choice of columns over every column: its own choices of known columns, in their
 * order, then every other column hidden, in the columns' order. So any column can be shown in
 * any section, and a column added after a preset was saved still shows up.
 */
export function allColumnChoices(
  choices: readonly StatColumnChoice[],
  columnIds: readonly string[],
): StatColumnChoice[] {
  const known = new Set(columnIds);
  const seen = new Set<string>();
  const own = choices.filter((c) => known.has(c.id) && !seen.has(c.id) && seen.add(c.id));
  return [...own, ...columnIds.filter((id) => !seen.has(id)).map((id) => ({ id, shown: false }))];
}

/** The columns a choice shows, in order. */
export function shownColumnIds(choices: readonly StatColumnChoice[]): string[] {
  return choices.filter((c) => c.shown).map((c) => c.id);
}

/**
 * Whether two choices show the same columns in the same order. Hidden columns and their order
 * don't count: the table is the same, so a preset still matches with the extra columns unticked.
 */
export function sameShownColumns(
  a: readonly StatColumnChoice[],
  b: readonly StatColumnChoice[],
): boolean {
  const x = shownColumnIds(a);
  const y = shownColumnIds(b);
  return x.length === y.length && x.every((id, i) => id === y[i]);
}
