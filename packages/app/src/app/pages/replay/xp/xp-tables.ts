import { Component, computed, inject, input } from '@angular/core';
import { StatRowHead, StatTable } from '@myrddraall/heroes-replay-stats-ui';
import type { XpPointRow } from '@myrddraall/heroprotocol-analysis';
import { TeamPerspective } from '../../../team/team-color';
import { XP_COLUMNS, xpTables } from './xp-rows';

/**
 * A replay's XP (presentational): for each team, coloured from your point of view, the XP it
 * gained from each source every minute, its XP so far and its level.
 */
@Component({
  selector: 'hrs-xp-tables',
  imports: [StatRowHead, StatTable],
  templateUrl: './xp-tables.html',
  styleUrl: './xp-tables.scss',
})
export class XpTables {
  readonly points = input.required<readonly XpPointRow[]>();

  private readonly perspective = inject(TeamPerspective);
  protected readonly columns = XP_COLUMNS;
  protected readonly tables = computed(() =>
    xpTables(this.points(), this.perspective.yourTeam(), this.perspective.mode()),
  );
}
