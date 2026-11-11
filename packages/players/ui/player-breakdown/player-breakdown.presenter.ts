import type { GameMode } from '@myrddraall/heroprotocol-db';
import type { HeroIcon, HeroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import type { StatColumn, StatRow } from '@myrddraall/heroes-replay-stats-replays/model';
import { MODE_LABELS } from '@myrddraall/heroes-replay-stats-replays/ui';
import {
  aggregateStats,
  groupGames,
  isSummed,
  NO_ROLE,
  RECORD_STAT_IDS,
  type Aggregate,
  type GroupBy,
  type PlayerGame,
} from '../../model';
import { averagedColumn } from '../player-columns';

/** What a breakdown's row is headed with: the group's name, and for a hero its portrait. */
export interface BreakdownRowData {
  readonly label: string;
  /** Whether the row is a hero's: headed as a score row, with the portrait once the data has it. */
  readonly hero: boolean;
  readonly portrait: HeroIcon | null;
}

/** A player's stats split one way: the columns as shown and a row for each group. */
export interface PlayerBreakdownModel {
  readonly columns: readonly StatColumn[];
  readonly rows: readonly StatRow<BreakdownRowData>[];
}

const ROLE_LABELS: Readonly<Record<string, string>> = {
  assassin: 'Assassin',
  warrior: 'Warrior',
  support: 'Support',
  specialist: 'Specialist',
  [NO_ROLE]: 'Unknown role',
};

/** What a breakdown's rows are, for the header over their heads. */
export const GROUP_BY_LABELS: Readonly<Record<GroupBy, string>> = {
  hero: 'Hero',
  role: 'Role',
  map: 'Map',
  mode: 'Mode',
};

export const AGGREGATE_LABELS: Readonly<Record<Aggregate, string>> = {
  average: 'Average',
  total: 'Total',
  best: 'Best',
};

function groupLabel(key: string, by: GroupBy): string {
  if (by === 'mode') return MODE_LABELS[key as GameMode] ?? key;
  if (by === 'role') return ROLE_LABELS[key] ?? key;
  return key;
}

/** From this figure up an average is shown whole: a decimal says nothing on damage in the thousands. */
const WHOLE_FROM = 100;

/**
 * A player's matches split by hero, role, map or mode, most matches first: the columns' figures
 * for each group, aggregated one way. As totals, the columns a sum means nothing for (rates, shares,
 * per-life figures) are left out; as averages, counts get a decimal.
 */
export function playerBreakdown(
  games: readonly PlayerGame[],
  by: GroupBy,
  columns: readonly StatColumn[],
  how: Aggregate,
  heroes: HeroLookup,
): PlayerBreakdownModel {
  const record: readonly string[] = RECORD_STAT_IDS;
  const kept = how === 'total' ? columns.filter((c) => record.includes(c.id) || isSummed(c)) : columns;
  const rows = groupGames(games, by).map((group): StatRow<BreakdownRowData> => {
    const first = group.games[0]!;
    return {
      key: group.key,
      group: null,
      values: aggregateStats(group.games, kept, how),
      data: {
        label: groupLabel(group.key, by),
        hero: by === 'hero',
        portrait: by === 'hero' ? heroes.heroPortrait(first.heroId, first.hero) : null,
      },
    };
  });
  const shown =
    how !== 'average'
      ? kept
      : kept.map((c) =>
          record.includes(c.id)
            ? c
            : averagedColumn(
                c,
                rows.some((r) => Math.abs(r.values[c.id] ?? 0) >= WHOLE_FROM),
              ),
        );
  return { columns: shown, rows };
}
