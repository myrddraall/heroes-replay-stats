import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  contentChild,
  DestroyRef,
  ElementRef,
  inject,
  input,
  LOCALE_ID,
  model,
  signal,
  untracked,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import {
  CellTemplate,
  DataGrid,
  GridColumn,
  HeaderTemplate,
  NumberCell,
} from '@myrddraall/heroes-replay-stats-data-views/ui';
import { ScoreCards } from '../score-cards/score-cards';
import type { StatColumn, StatRow } from '../../../model';
import { statTableRows, type StatTableRow } from '../stat-cells';
import { StatRowHead } from '../stat-row-head';
import { statBestFirst, type StatSort } from '../stat-sort';

/** How the table fits its width: as it is, squeezed (short numbers, tighter cells), or as cards. */
type Fit = 'full' | 'squeezed' | 'cards';

/**
 * A score-screen table (presentational, on the data grid): a few stats in large type, one row per player, the
 * headers as icons (or labels) named in tooltips, and each column's best marked, in the whole
 * table and within each row's group. The row head comes from a `uiStatRowHead` template inside.
 * Unsorted, the rows keep their given order.
 *
 * Its rows are sized by their height (`--hrs-grid-row-height`, the page's to change): the type is a
 * share of it and everything in a row is sized in em.
 *
 * It never scrolls sideways. When the table is wider than its place it squeezes (the host gets
 * `score-table--squeezed`, which a row head's own styles can follow), and when even that is too
 * wide it becomes a ranking (`ui-score-cards`), ranked by the sorted column or else the first,
 * best first. It goes back as soon as the width it needed is there again.
 */
@Component({
  selector: 'ui-score-table',
  imports: [
    CellTemplate,
    DataGrid,
    GridColumn,
    HeaderTemplate,
    MatIcon,
    MatTooltip,
    NgTemplateOutlet,
    NumberCell,
    ScoreCards,
  ],
  templateUrl: './score-table.html',
  styleUrl: './score-table.scss',
  host: { '[class.score-table--squeezed]': "fit() === 'squeezed'" },
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly fit = signal<Fit>('full');
  protected readonly asCards = computed(() => this.fit() === 'cards');
  protected readonly table = computed(() =>
    this.asCards() ? [] : statTableRows(this.rows(), this.columns(), this.sort(), this.locale, true),
  );

  /** The ranking the cards show: the sorted column, or else the first, best first. */
  private readonly ranking = computed(() => {
    const columns = this.columns();
    const id = this.sort()?.column;
    const column = columns.find((c) => c.id === id) ?? columns[0];
    return column ? statBestFirst(column) : null;
  });
  protected readonly rankBy = computed(() => this.ranking()?.column ?? '');
  protected readonly cards = computed(() =>
    this.asCards()
      ? statTableRows(this.rows(), this.columns(), this.ranking(), this.locale, true)
      : [],
  );

  /** The host's width, as last observed. */
  private readonly width = signal(0);
  /** The width the full and the squeezed table were found to need, for these rows and columns. */
  private needs: Partial<Record<Fit, number>> = {};
  private measured: readonly [readonly StatRow<T>[], readonly StatColumn[]] | null = null;

  constructor() {
    afterRenderEffect(() => {
      const width = this.width();
      const fit = this.fit();
      const rows = this.rows();
      const columns = this.columns();
      untracked(() => this.refit(width, fit, rows, columns));
    });
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => this.width.set(entry.contentRect.width));
    observer.observe(this.host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  /** A column's first press sorts best first: lowest first where lower is better (deaths). */
  protected readonly bestFirst = (column: StatColumn) => statBestFirst(column).direction;
  protected readonly byKey = (line: StatTableRow<T>) => line.row.key;
  protected readonly themeOf = (line: StatTableRow<T>) => line.row.theme ?? null;

  protected rankByColumn(id: string): void {
    const column = this.columns().find((c) => c.id === id);
    if (column) this.sort.set(statBestFirst(column));
  }

  /**
   * After a render or a resize: a step down when the table is wider than the host (noting the
   * width it needed), or back up when the host has the width a bigger fit needed. New rows or
   * columns are measured again from the full table.
   */
  private refit(
    width: number,
    fit: Fit,
    rows: readonly StatRow<T>[],
    columns: readonly StatColumn[],
  ): void {
    if (width === 0) return;
    if (this.measured?.[0] !== rows || this.measured[1] !== columns) {
      this.measured = [rows, columns];
      this.needs = {};
      if (fit !== 'full') {
        this.fit.set('full');
        return;
      }
    }
    // the grid's body (a theme part): wider inside than it shows, it doesn't fit
    const body = this.host.querySelector<HTMLElement>('.hrs-grid__body');
    if (body && body.scrollWidth > this.host.clientWidth) {
      this.needs[fit] = body.scrollWidth;
      this.fit.set(fit === 'full' ? 'squeezed' : 'cards');
    } else if (fit !== 'full' && width >= (this.needs.full ?? Infinity)) {
      this.fit.set('full');
    } else if (fit === 'cards' && width >= (this.needs.squeezed ?? Infinity)) {
      this.fit.set('squeezed');
    }
  }
}
