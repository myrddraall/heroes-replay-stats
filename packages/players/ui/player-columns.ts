import type { StatColumn } from '@myrddraall/heroes-replay-stats-replays/model';
import { STAT_COLUMNS } from '@myrddraall/heroes-replay-stats-replays/ui';
import { LENGTH_STAT_ID } from '../model';

/** The columns about a player's matches themselves, which a match's own stats have no use for. */
const MATCH_COLUMNS: readonly StatColumn[] = [
  { id: 'games', label: 'Matches', format: 'integer', better: 'higher' },
  { id: 'wins', label: 'Wins', format: 'integer', better: 'higher' },
  { id: 'losses', label: 'Losses', format: 'integer', better: 'lower' },
  {
    id: 'winRate',
    label: 'Win Rate',
    format: 'percent',
    digits: [0, 0],
    better: 'higher',
    description: 'Matches won, of those with a result.',
  },
  { id: LENGTH_STAT_ID, label: 'Match Length', format: 'clock' },
];

const BY_ID = new Map([...STAT_COLUMNS, ...MATCH_COLUMNS].map((c) => [c.id, c]));

/** A player's stats columns by id, in the ids' order: a match's stats columns and the matches' own. */
export function playerColumns(ids: readonly string[]): StatColumn[] {
  return ids.flatMap((id) => BY_ID.get(id) ?? []);
}

/**
 * A column as an average over matches shows it: a count gets a decimal (2.4 deaths a match), a
 * large figure stays whole.
 */
export function averagedColumn(column: StatColumn, large: boolean): StatColumn {
  return column.format === 'integer' && !large
    ? { ...column, format: 'decimal', digits: [1, 1] }
    : column;
}
