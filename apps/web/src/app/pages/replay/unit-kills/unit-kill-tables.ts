import { Component, computed, inject, input } from '@angular/core';
import { StatRowHead, StatTable } from '@myrddraall/heroes-replay-stats-ui';
import type { PlayerKillsRow, TeamKillsRow } from '@myrddraall/heroprotocol-analysis';
import type { HeroIcon } from '../../../data/heroes/hero-lookup';
import { TeamPerspective } from '../../../team/team-color';
import { PlayerCell } from '../player-cell';
import { playerRows } from '../player-rows';
import { teamRows } from '../team-rows';
import { UNIT_KILL_COLUMNS } from './unit-kill-columns';

/**
 * A replay's unit kills (presentational): the units each player and each team killed, by kind,
 * coloured from your point of view.
 */
@Component({
  selector: 'hrs-unit-kill-tables',
  imports: [PlayerCell, StatRowHead, StatTable],
  templateUrl: './unit-kill-tables.html',
  styleUrl: './unit-kill-tables.scss',
})
export class UnitKillTables {
  readonly players = input.required<readonly PlayerKillsRow[]>();
  readonly teams = input.required<readonly TeamKillsRow[]>();
  /** Each player's hero icon, by slot. */
  readonly icons = input.required<Readonly<Record<number, HeroIcon | null>>>();

  private readonly perspective = inject(TeamPerspective);
  protected readonly columns = UNIT_KILL_COLUMNS;
  protected readonly playerRows = computed(() =>
    playerRows(
      this.players(),
      this.icons(),
      this.columns,
      this.perspective.yourTeam(),
      this.perspective.mode(),
    ),
  );
  protected readonly teamRows = computed(() =>
    teamRows(this.teams(), this.columns, this.perspective.yourTeam(), this.perspective.mode()),
  );
}
