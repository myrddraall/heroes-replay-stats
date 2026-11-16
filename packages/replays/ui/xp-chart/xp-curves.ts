import type { XpPointRow } from '@myrddraall/heroprotocol-analysis';
import type { Team } from '@myrddraall/heroprotocol-db';
import { type TeamColor, teamColor, type TeamColorMode } from '../../model';
import { teamName } from '../stat-tables/team-rows';

/** Where a team's XP comes from, as the game breaks it down. */
export type XpSource = 'minionXP' | 'creepXP' | 'structureXP' | 'heroXP' | 'trickleXP';

/** A source of XP, as the chart names it. */
export interface XpSourceInfo {
  readonly id: XpSource;
  readonly label: string;
}

/** The sources, in the order the charts list them. */
export const XP_SOURCES: readonly XpSourceInfo[] = [
  { id: 'minionXP', label: 'Minions' },
  { id: 'creepXP', label: 'Mercenaries' },
  { id: 'structureXP', label: 'Structures' },
  { id: 'heroXP', label: 'Heroes' },
  { id: 'trickleXP', label: 'Passive' },
];

/**
 * The order the Sources chart stacks them in, from the bottom: their colours (`--xp-source-*`)
 * were checked for colour-blind separation between neighbours in this order.
 */
export const XP_STACK: readonly XpSource[] = [
  'trickleXP',
  'creepXP',
  'structureXP',
  'minionXP',
  'heroXP',
];

/** One point of a team's curve. */
export interface XpCurvePoint {
  /** On the game's clock. */
  readonly seconds: number;
  /** The team's level; null where the game didn't say. */
  readonly level: number | null;
  /** The team's XP so far from the chosen sources. */
  readonly xp: number;
  /** The XP from the chosen sources since the previous point, per minute. */
  readonly perMinute: number;
  /** The team's XP so far from each source. */
  readonly bySource: Readonly<Record<XpSource, number>>;
}

/** One team's XP over the game. */
export interface XpCurve {
  readonly team: Team;
  /** Its colour from your point of view. */
  readonly color: TeamColor;
  readonly name: string;
  readonly points: readonly XpCurvePoint[];
}

/**
 * Each team's XP over the game, your team (blue) first: a point per breakdown (once a minute, and
 * the end) with the XP so far from the `chosen` sources (the game's figures are running totals),
 * the rate it came in at since the previous point, and the team's level.
 */
export function xpCurves(
  points: readonly XpPointRow[],
  chosen: readonly XpSource[],
  yourTeam: Team | null,
  mode: TeamColorMode,
): XpCurve[] {
  const teams = [...new Set(points.map((p) => p.team))];
  const counted = (row: XpPointRow) => chosen.reduce((sum, s) => sum + row[s], 0);
  return teams
    .map((team): XpCurve => {
      const color = teamColor(team, yourTeam, mode);
      const rows = points.filter((p) => p.team === team).sort((a, b) => a.seq - b.seq);
      return {
        team,
        color,
        name: teamName(color),
        points: rows.map((row, i) => {
          const previous = rows[i - 1];
          const minutes = (row.seconds - row.previousSeconds) / 60;
          const gained = counted(row) - (previous ? counted(previous) : 0);
          return {
            seconds: row.seconds,
            level: row.teamLevel,
            xp: counted(row),
            perMinute: minutes > 0 ? gained / minutes : 0,
            bySource: Object.fromEntries(XP_SOURCES.map(({ id }) => [id, row[id]])) as Record<
              XpSource,
              number
            >,
          };
        }),
      };
    })
    .sort((a, b) => Number(a.color !== 'blue') - Number(b.color !== 'blue') || a.team - b.team);
}
