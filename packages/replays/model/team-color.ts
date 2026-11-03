import type { Team } from '@myrddraall/heroprotocol-db';

export type TeamColor = 'blue' | 'red';

/**
 * How teams get their colours. `relative` is the game's own view: your team is blue and
 * the other red. `fixed` is the observer's: the first team (0) is blue and the second red.
 */
export type TeamColorMode = 'relative' | 'fixed';

/**
 * The colour of `team`. Relative colouring needs to know your team; without it, it falls
 * back to the fixed colours.
 */
export function teamColor(team: Team, yourTeam: Team | null, mode: TeamColorMode): TeamColor {
  if (mode === 'relative' && yourTeam !== null) return team === yourTeam ? 'blue' : 'red';
  return team === 0 ? 'blue' : 'red';
}
