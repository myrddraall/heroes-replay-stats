import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import { ItemList, ItemTemplate } from '@myrddraall/heroes-replay-stats-data-views/ui';
import type { ReplayCard } from '../replay-list-item/replay-card';
import { ReplayListItem } from '../replay-list-item/replay-list-item';

/** The stored replays (presentational): a card each, or why there are none to show. */
@Component({
  selector: 'hrs-replay-list',
  imports: [EmptyState, ItemList, ItemTemplate, MatButtonModule, MatProgressBarModule, ReplayListItem],
  templateUrl: './replay-list.html',
  styleUrl: './replay-list.scss',
})
export class ReplayList {
  readonly cards = input.required<readonly ReplayCard[]>();
  /** How many of them an earlier version of the app imported (their details may be out of date). */
  readonly outdated = input(0);
  /** The replays have been read at least once. */
  readonly loaded = input(false);
  /** Why the replays couldn't be read. */
  readonly error = input<string | null>(null);
  /** The user asked to import replays. */
  readonly importRequested = output<void>();

  protected readonly byId = (card: ReplayCard) => card.replay.id;
}
