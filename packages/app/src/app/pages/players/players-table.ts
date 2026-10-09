import { DatePipe, PercentPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EmptyState } from '../empty-state';
import type { PlayerRow } from './player-row';

/** Everyone in the stored replays (presentational): a row each, and which accounts are me. */
@Component({
  selector: 'hrs-players-table',
  imports: [
    DatePipe,
    PercentPipe,
    EmptyState,
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
}
