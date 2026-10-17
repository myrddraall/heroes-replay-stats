import { computed, Injectable, type Signal, signal } from '@angular/core';
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

/**
 * Whose point of view the teams below a component are coloured from. A component showing
 * a replay provides one (`providers: [TeamPerspective]`) and points it at its "you" with
 * `follow()`; `hrsTeam` elements without one above them get the fixed colours.
 */
@Injectable()
export class TeamPerspective {
  private readonly source = signal<Signal<Team | null>>(signal(null));
  /** Your team in the replay; null when there is no "you" to go by. */
  readonly yourTeam = computed(() => this.source()());
  /** `relative` until there is a setting for it. */
  readonly mode = signal<TeamColorMode>('relative');

  /** Take your team from `yourTeam` from now on. */
  follow(yourTeam: Signal<Team | null>): void {
    this.source.set(yourTeam);
  }
}
