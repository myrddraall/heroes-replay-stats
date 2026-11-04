import { DatePipe, PercentPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import { CellTemplate, DataGrid, GridColumn } from '@myrddraall/heroes-replay-stats-data-views/ui';
import type { PlayerRow } from './players-table.presenter';

/** Everyone in the stored replays (presentational, on the data grid): a row each, and which accounts are me. */
@Component({
  selector: 'hrs-players-table',
  imports: [
    DatePipe,
    PercentPipe,
    CellTemplate,
    DataGrid,
    EmptyState,
    GridColumn,
    MatButtonModule,
    MatCheckboxModule,
    MatProgressBarModule,
  ],
  templateUrl: './players-table.html',
  styleUrl: './players-table.scss',
})
export class PlayersTable {
  readonly rows = input.required<readonly PlayerRow[]>();
  /** The players have been read at least once. */
  readonly loaded = input(false);
  /** Why the players couldn't be read. */
  readonly error = input<string | null>(null);
  /** An account was marked, or unmarked, as me. */
  readonly meChange = output<{ id: string; isMe: boolean }>();
  /** The user asked to import replays. */
  readonly importRequested = output<void>();

  protected readonly byId = (row: PlayerRow) => row.id;
}
