import { Component, input } from '@angular/core';
import type { Team } from '@myrddraall/heroprotocol-db';
import type { HeroIcon } from '@myrddraall/heroes-replay-stats-heroes/model';
import { StyledText } from '@myrddraall/heroes-replay-stats-common/ui';
import { PlayerCell } from '../player-cell/player-cell';
import { TeamTheme } from '../team-theme/team-theme';

/** A player on a side of a match: who, on which hero, and whether it is the user. */
export interface MatchTeamPlayer {
  readonly slot: number;
  readonly hero: string;
  readonly name: string;
  readonly icon: HeroIcon | null;
  readonly you: boolean;
}

/**
 * One side of a match (presentational): its result and its players, in the team's theme (`team`),
 * a bar fading out to the right behind them. Named for screen readers (`name`): its colour shows
 * it on screen. Victory glows in the legendary theme, Defeat plain in the team's; with no winner
 * (`won` null), neither.
 */
@Component({
  selector: 'hrs-match-team',
  imports: [PlayerCell, StyledText],
  hostDirectives: [{ directive: TeamTheme, inputs: ['hrsTeam: team'] }],
  host: { role: 'group', '[attr.aria-label]': 'name()' },
  templateUrl: './match-team.html',
  styleUrl: './match-team.scss',
})
export class MatchTeam {
  readonly name = input.required<string>();
  readonly won = input.required<boolean | null>();
  readonly players = input.required<readonly MatchTeamPlayer[]>();
  /** The side, for each player's own theme (the user's, `self`). */
  readonly team = input.required<Team>();
}
