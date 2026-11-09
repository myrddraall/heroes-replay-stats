import { Component, computed, input } from '@angular/core';
import { StyledText } from '@myrddraall/heroes-replay-stats-common/ui';
import type { HeroIcon } from '@myrddraall/heroes-replay-stats-heroes/model';
import { HeroPortrait } from '@myrddraall/heroes-replay-stats-heroes/ui';

/**
 * A unit's or a camp's row head (presentational), as a player's (`ui-score-row-head`) is: the
 * game's target portrait of each unit the row stands for, the row's full height (a camp of two
 * kinds of unit, Knights and their Mage, the second's layered over the first's faded end), the
 * row's in-game name bright beside them and where it is below, smaller. In a score row
 * (`_score-row.scss`): sized from the row's height and its type.
 */
@Component({
  selector: 'ui-unit-row-head',
  imports: [HeroPortrait, StyledText],
  templateUrl: './unit-row-head.html',
  styleUrl: './unit-row-head.scss',
})
export class UnitRowHead {
  /** One per kind of unit, the first the front one; none for a row the game has no portrait for. */
  readonly portraits = input<readonly HeroIcon[]>([]);
  readonly name = input.required<string>();
  /** Where it is (`Top, Blue team's side`, `Top lane`); none for a row without one. */
  readonly sub = input<string | null>(null);
  /**
   * Room for this many portraits (the most any row beside it has), so the rows' names line up;
   * its own portraits' by default.
   */
  readonly slots = input<number | null>(null);
  protected readonly slotCount = computed(() => this.slots() ?? this.portraits().length);
}
