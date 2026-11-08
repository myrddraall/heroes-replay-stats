import { Component, computed, input } from '@angular/core';
import { StyledText } from '@myrddraall/heroes-replay-stats-common/ui';
import { HexFrame, TeamLogo } from '@myrddraall/heroes-replay-stats-heroes/ui';

/**
 * A team row's head in a score row (presentational), as a player's (`ui-score-row-head`) is: the
 * game's logo in the row's theme where a player's portrait is (`hrs-team-logo`, lit while its row is
 * hovered), in the hex frame as a portrait is (`hrs-hex-frame`, the logo's `square`) on full-height
 * rows and alone in a compact table; the team's name bright beside it and its result below,
 * smaller. In a score row (`_score-row.scss`): sized from the row's height and its type.
 */
@Component({
  selector: 'ui-score-team-head',
  imports: [HexFrame, StyledText, TeamLogo],
  templateUrl: './score-team-head.html',
  styleUrl: './score-team-head.scss',
})
export class ScoreTeamHead {
  /** `Blue team`, from your point of view. */
  readonly name = input.required<string>();
  /** Victory or Defeat; none where there is no result. */
  readonly result = input<string | null>(null);

  protected readonly won = computed(() => this.result() === 'Victory');
}
