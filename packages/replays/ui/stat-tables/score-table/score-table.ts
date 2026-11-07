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
import { ScoreRowBar } from '../score-row/score-row-bar';
import type { StatColumn, StatRow } from '../../../model';
import { statTableRows, type StatTableRow } from '../stat-cells';
import { StatRowHead } from '../stat-row-head';
import { nextStatSort, statBestFirst, type StatSort } from '../stat-sort';

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
 * wide it becomes a ranking (`ui-score-cards`) in the table's own order: its chips sort as the
 * headers do (best first, worst first, unsorted). It goes back as soon as the width it needed is
 * there again.
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
    ScoreRowBar,
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

  /** The column the cards are ranked by, and whether best or worst first; none when unsorted. */
  protected readonly rankBy = computed(() => this.sort()?.column ?? null);
  protected readonly rankOrder = computed(() => {
    const sort = this.sort();
    const column = this.columns().find((c) => c.id === sort?.column);
    if (!sort || !column) return null;
    return sort.direction === statBestFirst(column).direction ? 'best-first' : 'worst-first';
  });
  /** The cards in the table's order: its sort, or the rows' own order when unsorted. */
  protected readonly cards = computed(() =>
    this.asCards()
      ? statTableRows(this.rows(), this.columns(), this.sort(), this.locale, true)
      : [],
  );

  /** The host's width, as last observed. */
  private readonly width = signal(0);
  /**
   * The grid's rows' width, as last observed: the grid draws its rows after its own first render,
   * so a table measured before then looks as if it fits; their growing measures it again.
   */
  private readonly contentWidth = signal(0);
  /** The width the full and the squeezed table were found to need, for these rows and columns. */
  private needs: Partial<Record<Fit, number>> = {};
  private measured: readonly [readonly StatRow<T>[], readonly StatColumn[]] | null = null;
  /** Watches the grid's rows (`contentWidth`), whichever grid is drawn now. */
  private contentObserver: ResizeObserver | null = null;
  private observedContent: Element | null = null;

  constructor() {
    afterRenderEffect(() => {
      const width = this.width();
      this.contentWidth();
      const fit = this.fit();
      const rows = this.rows();
      const columns = this.columns();
      untracked(() => {
        this.watchContent();
        this.refit(width, fit, rows, columns);
      });
    });
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => this.width.set(entry.contentRect.width));
    observer.observe(this.host);
    this.contentObserver = new ResizeObserver(([entry]) =>
      this.contentWidth.set(entry.target.scrollWidth),
    );
    inject(DestroyRef).onDestroy(() => {
      observer.disconnect();
      this.contentObserver?.disconnect();
    });
  }

  /** Observes the drawn grid's rows (the grid's body content), following the grid as it comes and goes. */
  private watchContent(): void {
    const rows = this.host.querySelector('.hrs-grid__body')?.firstElementChild ?? null;
    if (rows === this.observedContent) return;
    if (this.observedContent) this.contentObserver?.unobserve(this.observedContent);
    if (rows) this.contentObserver?.observe(rows);
    this.observedContent = rows;
  }

  /** A column's first press sorts best first: lowest first where lower is better (deaths). */
  protected readonly bestFirst = (column: StatColumn) => statBestFirst(column).direction;
  protected readonly byKey = (line: StatTableRow<T>) => line.row.key;
  protected readonly themeOf = (line: StatTableRow<T>) => line.row.theme ?? null;

  /** A card chip was pressed: as the table's header, best first, then worst first, then unsorted. */
  protected rankByColumn(id: string): void {
    const column = this.columns().find((c) => c.id === id);
    if (column) this.sort.set(nextStatSort(this.sort(), column));
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
