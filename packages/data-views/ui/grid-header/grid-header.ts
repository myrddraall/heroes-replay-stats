import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  viewChildren,
} from '@angular/core';
import type { GridSort } from '../../model';
import type { AttachableGrid, DataGridColumn, HeaderWidth } from '../data-grid/grid-column';

let nextId = 0;

/**
 * A data grid's header, attached to it by reference and placed by the page beside it:
 * `<hrs-grid-header [for]="grid" />` with `<hrs-data-grid #grid>`. A header cell for each column the
 * grid shows, drawing the column's `hrsHeader` template or its `header`, lined up with the
 * columns and following the grid's sideways scroll, stuck to the top of the view as the page
 * scrolls (the theme's `hrs-grid__head`). A sortable column's header sorts the grid (its first
 * press in the column's direction, else the grid's, then the other way, then unsorted), its order
 * in `aria-sort`. The widths its cells want (labels wrapped, and on one line) go to the grid, which
 * sizes its columns by them as by their cells. Its row is the grid's for screen readers (`aria-owns`).
 */
@Component({
  selector: 'hrs-grid-header',
  imports: [NgTemplateOutlet],
  templateUrl: './grid-header.html',
  styleUrl: './grid-header.scss',
  host: { class: 'hrs-grid__head', '[class.is-scrolled]': 'for().scrolled()' },
})
export class GridHeader {
  /** The grid it heads. */
  readonly for = input.required<AttachableGrid>();

  protected readonly rowId = `hrs-grid-header-${nextId++}`;
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly contents = viewChildren<ElementRef<HTMLElement>>('content');

  constructor() {
    // the row is the grid's, for screen readers
    effect((onCleanup) => onCleanup(this.for().attachHeader(this.rowId)));
    // following the grid's sideways scroll
    effect(() => (this.element.scrollLeft = this.for().scrollLeft()));
    // the widths the cells want, for the grid's columns: the least (labels wrapped) and the most
    // (labels on one line)
    afterRenderEffect(() => {
      const grid = this.for();
      const columns = grid.shownColumns();
      const contents = this.contents();
      const widths: Record<string, HeaderWidth> = {};
      contents.forEach(({ nativeElement: content }, i) => {
        const name = columns[i]?.name();
        if (name === undefined) return;
        const cell = content.closest<HTMLElement>('[role="columnheader"]');
        const style = cell ? getComputedStyle(cell) : null;
        const padding = style ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) : 0;
        content.style.width = 'min-content';
        const min = content.offsetWidth;
        content.style.width = 'max-content';
        const max = content.offsetWidth;
        content.style.width = '';
        widths[name] = { min: Math.ceil(min + padding), max: Math.ceil(max + padding) };
      });
      grid.setHeaderWidths(widths);
    });
    inject(DestroyRef).onDestroy(() => this.for().setHeaderWidths({}));
  }

  protected ariaSort(column: DataGridColumn): 'ascending' | 'descending' | 'none' | null {
    if (!column.sortable()) return null;
    const sort = this.for().sort();
    if (sort?.column !== column.name()) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  /** A sortable column's header pressed: its first direction, then the other, then unsorted. */
  protected sortBy(column: DataGridColumn): void {
    const grid = this.for();
    const start = column.sortStart() ?? grid.sortStart();
    const sort = grid.sort();
    let next: GridSort | null;
    if (sort?.column !== column.name()) next = { column: column.name(), direction: start };
    else if (sort.direction === start) next = { column: column.name(), direction: start === 'asc' ? 'desc' : 'asc' };
    else next = null;
    grid.sort.set(next);
  }
}
