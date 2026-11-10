import type { StatColumn, StatRow } from '../../model';
import type { Team } from '@myrddraall/heroprotocol-db';
import { type TeamColor, teamColor, type TeamColorMode } from '../../model';
import { statValues } from './player-rows';

/** A team as its colour names it: `Blue team` or `Red team`. */
export function teamName(color: TeamColor): string {
  return color === 'blue' ? 'Blue team' : 'Red team';
}

/** Who a team stats row is: the team, and its colour and name from your point of view. */
export interface TeamRowData {
  readonly team: Team;
  readonly color: TeamColor;
  readonly name: string;
}

/**
 * One stats row per team, themed in its colour from your point of view, your team (blue) first,
 * with the columns' stats.
 */
export function teamRows(
  teams: readonly (object & { readonly team: Team })[],
  columns: readonly StatColumn[],
  yourTeam: Team | null,
  mode: TeamColorMode,
): StatRow<TeamRowData>[] {
  return teams
    .map((row) => {
      const color = teamColor(row.team, yourTeam, mode);
      return {
        key: row.team,
        group: null,
        values: statValues(row, columns),
        theme: color,
        data: { team: row.team, color, name: teamName(color) },
      };
    })
    .sort(
      (a, b) =>
        Number(a.theme !== 'blue') - Number(b.theme !== 'blue') ||
        a.key - b.key,
    );
}
