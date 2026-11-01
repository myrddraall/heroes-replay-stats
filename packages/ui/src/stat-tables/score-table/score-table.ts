import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, contentChild, inject, input, LOCALE_ID, model } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import type { StatColumn, StatRow } from '../stat-column';
import { statTableRows } from '../stat-cells';
import { StatRowHead } from '../stat-row-head';
import { nextStatSort, statAriaSort, type StatSort } from '../stat-sort';
import { StatSortHeader } from '../stat-sort-header';

/**
 * A score-screen table (presentational): a few stats in large type, one row per player, the
 * headers as icons (or labels) named in tooltips, and each column's best marked, in the whole
 * table and within each row's group. The row head comes from a `uiStatRowHead` template inside.
 * Unsorted, the rows keep their given order.
 */
@Component({
  selector: 'ui-score-table',
  imports: [MatIcon, MatTooltip, NgTemplateOutlet, StatSortHeader],
  templateUrl: './score-table.html',
  styleUrl: './score-table.scss',
})
export class ScoreTable<T> {
  readonly columns = input.required<readonly StatColumn[]>();
  readonly rows = input.required<readonly StatRow<T>[]>();
  /** What the row heads are, for the header over them (read by screen readers). */
  readonly rowHeadLabel = input('Player');
  /** The table's order; none keeps the rows' own. */
  readonly sort = model<StatSort | null>(null);

  protected readonly rowHead = contentChild<StatRowHead<T>>(StatRowHead);
  private readonly locale = inject(LOCALE_ID);
  protected readonly table = computed(() =>
    statTableRows(this.rows(), this.columns(), this.sort(), this.locale, true),
  );

  protected ariaSort(column: string): 'ascending' | 'descending' | null {
    return statAriaSort(this.sort(), column);
  }

  protected toggleSort(column: string): void {
    this.sort.update((sort) => nextStatSort(sort, column));
  }
}
