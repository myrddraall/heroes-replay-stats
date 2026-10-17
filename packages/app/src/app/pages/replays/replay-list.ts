import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EmptyState } from '../empty-state';
import type { ReplayCard } from './replay-card';
import { ReplayListItem } from './replay-list-item';

/** The stored replays (presentational): a card each, or why there are none to show. */
@Component({
  selector: 'hrs-replay-list',
  imports: [EmptyState, MatButtonModule, MatProgressBarModule, ReplayListItem],
  templateUrl: './replay-list.html',
  styleUrl: './replay-list.scss',
})
export class ReplayList {
  readonly cards = input.required<readonly ReplayCard[]>();
  /** The replays have been read at least once. */
  readonly loaded = input(false);
  /** Why the replays couldn't be read. */
  readonly error = input<string | null>(null);
  /** The user asked to import replays. */
  readonly importRequested = output<void>();
}
