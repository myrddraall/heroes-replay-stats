import { DatePipe, PercentPipe } from '@angular/common';
import { Component, input, model, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
import type { PlayerRow } from './players-table.presenter';

/**
 * Everyone in the stored replays (presentational, on the data grid): a row each, which accounts are
 * me, and a search by name. A player's name opens their page.
 */
@Component({
  selector: 'hrs-players-table',
  imports: [
    DatePipe,
    PercentPipe,
    CellTemplate,
    DataGrid,
    EmptyState,
    GridColumn,
    GridHeader,
    GridRowElement,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    RouterLink,
    RowTemplate,
  ],
  templateUrl: './players-table.html',
  styleUrl: './players-table.scss',
})
export class PlayersTable {
  /** The rows to show: everyone, or those the search keeps. */
  readonly rows = input.required<readonly PlayerRow[]>();
  /** How many players there are before searching. */
  readonly total = input(0);
  /** What the search field holds. */
  readonly search = model('');
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
