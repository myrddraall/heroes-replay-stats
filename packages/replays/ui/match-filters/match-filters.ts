import { Component, computed, input, model } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  ANY_MATCH,
  isFiltering,
  PLAYED_WITHIN,
  type MatchFilter,
  type MatchOptions,
  type PlayedWithin,
} from '../../model';
import { MODE_LABELS } from '../replay-list-item/replay-list-item';

const PLAYED_LABELS: Readonly<Record<PlayedWithin, string>> = {
  any: 'Any time',
  today: 'Today',
  week: '7 days',
  month: '30 days',
};

/**
 * The choices that narrow the match list (presentational): a search, the map, mode and your hero
 * among those in the matches, and how recently they were played. Your hero shows only when the
 * matches know who you are.
 */
@Component({
  selector: 'hrs-match-filters',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './match-filters.html',
  styleUrl: './match-filters.scss',
})
export class MatchFilters {
  readonly options = input.required<MatchOptions>();
  readonly filter = model<MatchFilter>(ANY_MATCH);

  protected readonly modeLabels = MODE_LABELS;
  protected readonly played = PLAYED_WITHIN.map((value) => ({ value, label: PLAYED_LABELS[value] }));
  protected readonly filtering = computed(() => isFiltering(this.filter()));

  protected set(changes: Partial<MatchFilter>): void {
    this.filter.update((filter) => ({ ...filter, ...changes }));
  }

  protected clear(): void {
    this.filter.set(ANY_MATCH);
  }
}
