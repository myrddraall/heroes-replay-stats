import { Component, input } from '@angular/core';
import { HeroMinimapIcon } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { TeamTheme } from '@myrddraall/heroes-replay-stats-replays/ui';
import type { DraftStep } from './draft-steps';

/**
 * A replay's draft (presentational): its bans and picks in order, each in its team's colour with
 * the hero and, for a pick, the player.
 */
@Component({
  selector: 'hrs-draft-list',
  imports: [HeroMinimapIcon, TeamTheme],
  templateUrl: './draft-list.html',
  styleUrl: './draft-list.scss',
})
export class DraftList {
  readonly steps = input.required<readonly DraftStep[]>();
}
