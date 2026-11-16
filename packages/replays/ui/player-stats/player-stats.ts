import { Component, computed, inject, input } from '@angular/core';
import { type StatColumn } from '../../model';
import { StatRowHead } from '../stat-tables/stat-row-head';
import { StatTable } from '../stat-tables/stat-table/stat-table';
import type { PlayerStatsRow } from '@myrddraall/heroprotocol-analysis';
import type { HeroIcon } from '@myrddraall/heroes-replay-stats-heroes/model';
import { TeamPerspective } from '../team-theme/team-perspective';
import { ScoreRowHead } from '../stat-tables/score-row/score-row-head';
import { playerRows } from '../stat-tables/player-rows';

/**
 * A player stats section's table (presentational): the chosen stats, one row per player coloured
 * from your point of view, each headed as the score table's (the hero's portrait fading out, the names).
 */
@Component({
  selector: 'hrs-player-stats',
  imports: [ScoreRowHead, StatRowHead, StatTable],
  templateUrl: './player-stats.html',
  styleUrl: './player-stats.scss',
})
export class PlayerStats {
  readonly title = input.required<string>();
  readonly players = input.required<readonly PlayerStatsRow[]>();
  /** Each player's leaderboard portrait, by slot. */
  readonly portraits = input.required<Readonly<Record<number, HeroIcon | null>>>();
  /** Your slots: your rows in your side's self theme. */
  readonly you = input<ReadonlySet<number>>(new Set());
  /** The columns the table shows, in order. */
  readonly shownColumns = input.required<readonly StatColumn[]>();

  private readonly perspective = inject(TeamPerspective);
  protected readonly rows = computed(() =>
    playerRows(
      this.players(),
      this.portraits(),
      this.shownColumns(),
      this.perspective.yourTeam(),
      this.perspective.mode(),
      this.you(),
    ),
  );
}
