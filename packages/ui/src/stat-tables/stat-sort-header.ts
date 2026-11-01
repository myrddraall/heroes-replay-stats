import { Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import type { StatSort } from './stat-sort';

/**
 * The button in a stat table's column header that sorts by its column when pressed, with an
 * arrow for the direction: `<ui-stat-sort-header [column]="column.id" [sort]="sort()"
 * (sortRequested)="…">label</ui-stat-sort-header>`. The header cell takes its `aria-sort` from
 * {@link statAriaSort}.
 */
@Component({
  selector: 'ui-stat-sort-header',
  imports: [MatIcon],
  templateUrl: './stat-sort-header.html',
  styleUrl: './stat-sort-header.scss',
})
export class StatSortHeader {
  /** The column this header sorts by. */
  readonly column = input.required<string>();
  /** The table's order. */
  readonly sort = input<StatSort | null>(null);
  readonly sortRequested = output<void>();

  protected readonly direction = computed(() => {
    const sort = this.sort();
    return sort?.column === this.column() ? sort.direction : null;
  });
}
