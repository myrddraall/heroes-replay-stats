import { formatStatClock } from '../stat-tables/stat-format';
import { type StatColumn, type StatRow } from '../../model';
import type { XpPointRow } from '@myrddraall/heroprotocol-analysis';
import type { Team } from '@myrddraall/heroprotocol-db';
import { teamColor, type TeamColorMode } from '../../model';
import { teamName } from '../stat-tables/team-rows';

const since = 'since the previous time';

/** The XP tables' columns: the team's level, its XP from each source since the previous time, its XP so far. */
export const XP_COLUMNS: readonly StatColumn[] = [
  { id: 'teamLevel', label: 'Level', format: 'integer' },
  {
    id: 'minionXP',
    label: 'Minions',
    format: 'integer',
    description: `XP from minions ${since}.`,
  },
  {
    id: 'creepXP',
    label: 'Mercenaries',
    format: 'integer',
    description: `XP from mercenaries and other neutral units ${since}.`,
  },
  {
    id: 'structureXP',
    label: 'Structures',
    format: 'integer',
    description: `XP from structures ${since}.`,
  },
  { id: 'heroXP', label: 'Heroes', format: 'integer', description: `XP from heroes ${since}.` },
  {
    id: 'trickleXP',
    label: 'Passive',
    format: 'integer',
    description: `XP the team earns over time ${since}.`,
  },
  { id: 'gained', label: 'Gained', format: 'integer', description: `All XP ${since}.` },
  { id: 'total', label: 'Total', format: 'integer', description: "The team's XP so far." },
];

/** What an XP row's head shows: when in the game, `m:ss`. */
export interface XpRowData {
  readonly time: string;
}

/** One team's XP table. */
export interface XpTable {
  readonly team: Team;
  readonly name: string;
  readonly rows: readonly StatRow<XpRowData>[];
}

const SOURCES = ['minionXP', 'creepXP', 'structureXP', 'heroXP', 'trickleXP'] as const;

/**
 * Each team's XP over the game, your team (blue) first: a row per point of its curve (once a
 * minute, and the end), with the XP from each source gained since the previous point (the game's
 * figures are running totals), the XP gained, the XP so far and the team's level.
 */
export function xpTables(
  points: readonly XpPointRow[],
  yourTeam: Team | null,
  mode: TeamColorMode,
): XpTable[] {
  const teams = [...new Set(points.map((p) => p.team))];
  return teams
    .map((team) => {
      const color = teamColor(team, yourTeam, mode);
      const curve = points.filter((p) => p.team === team).sort((a, b) => a.seq - b.seq);
      return {
        team,
        color,
        name: teamName(color),
        rows: curve.map((point, i): StatRow<XpRowData> => {
          const previous = curve[i - 1];
          const gained = Object.fromEntries(
            SOURCES.map((s) => [s, point[s] - (previous?.[s] ?? 0)]),
          );
          return {
            key: point.seq,
            group: null,
            values: {
              teamLevel: point.teamLevel,
              ...gained,
              gained: point.gained,
              total: point.total,
            },
            class: `hrs-glass-${color}`,
            data: { time: formatStatClock(point.seconds) },
          };
        }),
      };
    })
    .sort((a, b) => Number(a.color !== 'blue') - Number(b.color !== 'blue') || a.team - b.team)
    .map(({ team, name, rows }) => ({ team, name, rows }));
}
