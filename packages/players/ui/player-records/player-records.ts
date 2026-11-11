import { DatePipe } from '@angular/common';
import { Component, inject, input, LOCALE_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import {
  CellTemplate,
  DataGrid,
  GridColumn,
  GridHeader,
  GridRowElement,
  RowTemplate,
} from '@myrddraall/heroes-replay-stats-data-views/ui';
import { HeroMinimapIcon } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { formatStat } from '@myrddraall/heroes-replay-stats-replays/ui';
import type { PlayerRecordRow } from './player-records.presenter';

/**
 * A player's records (presentational, on the data grid): their highest figure for each stat in one
 * match, and that match (the hero, the map, the mode, when), which opens from its row.
 */
@Component({
  selector: 'hrs-player-records',
  imports: [
    CellTemplate,
    DataGrid,
    DatePipe,
    EmptyState,
    GridColumn,
    GridHeader,
    GridRowElement,
    HeroMinimapIcon,
    RouterLink,
    RowTemplate,
  ],
  templateUrl: './player-records.html',
  styleUrl: './player-records.scss',
})
export class PlayerRecords {
  readonly rows = input.required<readonly PlayerRecordRow[]>();

  private readonly locale = inject(LOCALE_ID);
  protected readonly byStat = (row: PlayerRecordRow) => row.column.id;
  protected format(row: PlayerRecordRow): string {
    return formatStat(row.value, row.column, this.locale);
  }
}
