import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EmptyState } from '@myrddraall/heroes-replay-stats-common/ui';
import {
  GroupHeaderTemplate,
  ItemList,
  ItemTemplate,
} from '@myrddraall/heroes-replay-stats-data-views/ui';
import { playedDay } from '../../model';
import type { ReplayCard } from '../replay-list-item/replay-card';
import { ReplayListItem } from '../replay-list-item/replay-list-item';

/**
 * The stored replays (presentational): a card each, under the day it was played, or why there are
 * none to show. What narrows them (the filter bar) goes in its content, above the cards.
 */
@Component({
  selector: 'hrs-replay-list',
  imports: [
    DatePipe,
    EmptyState,
    GroupHeaderTemplate,
    ItemList,
    ItemTemplate,
    MatButtonModule,
    MatProgressBarModule,
    ReplayListItem,
  ],
  templateUrl: './replay-list.html',
  styleUrl: './replay-list.scss',
})
export class ReplayList {
  /** The cards to show: every match, or those a filter keeps. */
  readonly cards = input.required<readonly ReplayCard[]>();
  /** How many matches there are before filtering. */
  readonly total = input(0);
  /** How many of them an earlier version of the app imported (their details may be out of date). */
  readonly outdated = input(0);
  /** The replays have been read at least once. */
  readonly loaded = input(false);
  /** Why the replays couldn't be read. */
  readonly error = input<string | null>(null);
  /** The user asked to import replays. */
  readonly importRequested = output<void>();

  protected readonly byId = (card: ReplayCard) => card.replay.id;
  protected readonly byDay = (card: ReplayCard) => playedDay(card.replay.playedAt);
  /** A day's key (`2026-11-04`) as that day, local time. */
  protected dayOf(day: string): Date {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year!, month! - 1, date);
  }
}
