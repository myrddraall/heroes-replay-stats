import type { StatColumn, StatRow } from '@myrddraall/heroes-replay-stats-common/ui';
import type { TeamStatsRow } from '@myrddraall/heroprotocol-analysis';
import type { Team } from '@myrddraall/heroprotocol-db';
import type { TeamColorMode } from '../../../team/team-color';
import { type TeamRowData, teamRows } from '../team-rows';

/** A group of team stats, shown as its own table. */
export interface TeamStatGroup {
  readonly id: string;
  readonly title: string;
  readonly columns: readonly StatColumn[];
}

const summed = 'summed over the players';

/** The team stats by group, in the order the page shows them, by the `teamStats` table's keys. */
export const TEAM_STAT_GROUPS: readonly TeamStatGroup[] = [
  {
    id: 'combat',
    title: 'Combat',
    columns: [
      { id: 'kills', label: 'Kills', format: 'integer' },
      { id: 'deaths', label: 'Deaths', format: 'integer' },
      {
        id: 'teamKDA',
        label: 'KDA',
        format: 'decimal',
        description: "Kills for each of the team's deaths.",
      },
      {
        id: 'peoplePerKill',
        label: 'Heroes per Kill',
        format: 'decimal',
        digits: [1, 1],
        description: 'How many heroes on the team took part in each enemy death, on average.',
      },
      {
        id: 'heroDamage',
        label: 'Hero Damage',
        format: 'integer',
        description: `Hero damage ${summed}.`,
      },
      {
        id: 'siegeDamage',
        label: 'Siege Damage',
        format: 'integer',
        description: `Siege damage ${summed}.`,
      },
      { id: 'healing', label: 'Healing', format: 'integer', description: `Healing ${summed}.` },
      {
        id: 'shielding',
        label: 'Protection',
        format: 'integer',
        description: `Protection given to allies ${summed}.`,
      },
      {
        id: 'damageTaken',
        label: 'Damage Taken',
        format: 'integer',
        description: `Damage taken ${summed}.`,
      },
      {
        id: 'ccSeconds',
        label: 'Total CC',
        format: 'duration',
        description: `Crowd control on enemy heroes ${summed}, for every enemy hero affected.`,
      },
      {
        id: 'timeDead',
        label: 'Time Dead',
        format: 'duration',
        description: `Time spent dead ${summed}.`,
      },
      {
        id: 'averageTimeDead',
        label: 'Time Dead / Player',
        format: 'duration',
        description: 'Time spent dead per player on the team.',
      },
    ],
  },
  {
    id: 'xp',
    title: 'XP',
    columns: [
      { id: 'level', label: 'Level', format: 'integer' },
      { id: 'minionXP', label: 'Minions', format: 'integer', description: 'XP from minions.' },
      {
        id: 'creepXP',
        label: 'Mercenaries',
        format: 'integer',
        description: 'XP from mercenaries and other neutral units.',
      },
      {
        id: 'structureXP',
        label: 'Structures',
        format: 'integer',
        description: 'XP from structures.',
      },
      { id: 'heroXP', label: 'Heroes', format: 'integer', description: 'XP from heroes.' },
      {
        id: 'trickleXP',
        label: 'Passive',
        format: 'integer',
        description: 'XP the team earned over time.',
      },
      { id: 'totalXP', label: 'Total', format: 'integer', description: "The team's XP." },
    ],
  },
  {
    id: 'structures',
    title: 'Structures',
    columns: [
      {
        id: 'fortsDestroyed',
        label: 'Forts Destroyed',
        format: 'integer',
        description: 'Enemy forts the team destroyed.',
      },
      {
        id: 'firstFortSeconds',
        label: 'First Fort',
        format: 'clock',
        description: 'When the team destroyed its first enemy fort.',
      },
      {
        id: 'keepsDestroyed',
        label: 'Keeps Destroyed',
        format: 'integer',
        description: 'Enemy keeps the team destroyed.',
      },
      {
        id: 'firstKeepSeconds',
        label: 'First Keep',
        format: 'clock',
        description: 'When the team destroyed its first enemy keep.',
      },
      { id: 'fortsLost', label: 'Forts Lost', format: 'integer' },
      { id: 'keepsLost', label: 'Keeps Lost', format: 'integer' },
      { id: 'towersLost', label: 'Towers Lost', format: 'integer' },
      { id: 'gatesLost', label: 'Gates Lost', format: 'integer' },
      { id: 'wallsLost', label: 'Walls Lost', format: 'integer' },
      { id: 'wellsLost', label: 'Wells Lost', format: 'integer' },
      {
        id: 'coreSeconds',
        label: 'Core Destroyed',
        format: 'clock',
        description: "When the team's core was destroyed.",
      },
    ],
  },
  {
    id: 'camps',
    title: 'Camps',
    columns: [
      { id: 'campCaptures', label: 'Camps Taken', format: 'integer' },
      { id: 'campsSiege', label: 'Siege', format: 'integer', description: 'Siege camps taken.' },
      {
        id: 'campsBruiser',
        label: 'Bruiser',
        format: 'integer',
        description: 'Bruiser camps taken.',
      },
      { id: 'campsBoss', label: 'Boss', format: 'integer', description: 'Bosses taken.' },
      {
        id: 'campsOther',
        label: 'Other',
        format: 'integer',
        description: "Other camps taken, such as Blackheart's Bay's doubloon camps.",
      },
      {
        id: 'firstCampSeconds',
        label: 'First Camp',
        format: 'clock',
        description: 'When the team took its first camp.',
      },
    ],
  },
];

/** A team stats row: the team, its name from your point of view and its result. */
export interface TeamStatsRowData extends TeamRowData {
  /** Null when the replay does not say who won. */
  readonly result: 'Victory' | 'Defeat' | null;
}

/**
 * One row per team for a group's columns, themed in its colour from your point of view, your
 * team first, with its result when the replay says who won.
 */
export function teamStatRows(
  teams: readonly TeamStatsRow[],
  columns: readonly StatColumn[],
  yourTeam: Team | null,
  mode: TeamColorMode,
): StatRow<TeamStatsRowData>[] {
  const decided = teams.some((t) => t.won);
  const won = new Map(teams.map((t) => [t.team, t.won]));
  return teamRows(teams, columns, yourTeam, mode).map((row) => ({
    ...row,
    data: {
      ...row.data,
      result: decided ? (won.get(row.data.team) ? 'Victory' : 'Defeat') : null,
    },
  }));
}
