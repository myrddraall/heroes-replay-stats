import { Component, computed, inject, input } from '@angular/core';
import { StatRowHead } from '../stat-tables/stat-row-head';
import { StatTable } from '../stat-tables/stat-table/stat-table';
import type { PlayerKillsRow, TeamKillsRow } from '@myrddraall/heroprotocol-analysis';
import type { HeroIcon } from '@myrddraall/heroes-replay-stats-heroes/model';
import { TeamPerspective } from '../team-theme/team-perspective';
import { ScoreRowHead } from '../stat-tables/score-row/score-row-head';
import { playerRows } from '../stat-tables/player-rows';
import { teamRows } from '../stat-tables/team-rows';
import { UNIT_KILL_COLUMNS } from './unit-kill-columns';

/**
 * A replay's unit kills (presentational): the units each player, or each team, killed, by kind,
 * coloured from your point of view.
 */
@Component({
  selector: 'hrs-unit-kill-tables',
  imports: [ScoreRowHead, StatRowHead, StatTable],
  templateUrl: './unit-kill-tables.html',
  styleUrl: './unit-kill-tables.scss',
})
export class UnitKillTables {
  readonly players = input.required<readonly PlayerKillsRow[]>();
  readonly teams = input.required<readonly TeamKillsRow[]>();
  /** Whose kills: each player's, or each team's. */
  readonly table = input.required<'players' | 'teams'>();
  /** Each player's leaderboard portrait, by slot. */
  readonly portraits = input.required<Readonly<Record<number, HeroIcon | null>>>();
  /** Your slots: your rows in your side's self theme. */
  readonly you = input<ReadonlySet<number>>(new Set());

  private readonly perspective = inject(TeamPerspective);
  protected readonly columns = UNIT_KILL_COLUMNS;
  protected readonly playerRows = computed(() =>
    playerRows(
      this.players(),
      this.portraits(),
      this.columns,
      this.perspective.yourTeam(),
      this.perspective.mode(),
      this.you(),
    ),
  );
  protected readonly teamRows = computed(() =>
    teamRows(this.teams(), this.columns, this.perspective.yourTeam(), this.perspective.mode()),
  );
}
