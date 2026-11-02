import { Component, computed, inject, input } from '@angular/core';
import { type StatColumn, StatRowHead, StatTable } from '@myrddraall/heroes-replay-stats-common/ui';
import type { PlayerStatsRow } from '@myrddraall/heroprotocol-analysis';
import type { HeroIcon } from '../../../data/heroes/hero-lookup';
import { TeamPerspective } from '../../../team/team-color';
import { PlayerCell } from '../player-cell';
import { playerRows } from '../player-rows';

/**
 * A player stats section's table (presentational): the chosen stats, one row per player coloured
 * from your point of view.
 */
@Component({
  selector: 'hrs-player-stats',
  imports: [PlayerCell, StatRowHead, StatTable],
  templateUrl: './player-stats.html',
  styleUrl: './player-stats.scss',
})
export class PlayerStats {
  readonly title = input.required<string>();
  readonly players = input.required<readonly PlayerStatsRow[]>();
  /** Each player's hero icon, by slot. */
  readonly icons = input.required<Readonly<Record<number, HeroIcon | null>>>();
  /** The columns the table shows, in order. */
  readonly shownColumns = input.required<readonly StatColumn[]>();

  private readonly perspective = inject(TeamPerspective);
  protected readonly rows = computed(() =>
    playerRows(
      this.players(),
      this.icons(),
      this.shownColumns(),
      this.perspective.yourTeam(),
      this.perspective.mode(),
    ),
  );
}
