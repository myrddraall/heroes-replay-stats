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
  linkedSignal,
  LOCALE_ID,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { CellTemplate, DataGrid, GridColumn, GridHeader, GridRowElement, HeaderTemplate, NumberCell, RowTemplate } from '@myrddraall/heroes-replay-stats-data-views/ui';
import { ScoreRowBar } from '../score-row/score-row-bar';
import type { StatColumn, StatRow, StatSupport } from '../../../model';
import { statTableRows, type StatTableRow } from '../stat-cells';
import { StatRowHead } from '../stat-row-head';
import { statBestFirst, type StatSort } from '../stat-sort';
import { STAT_SUPPORT_LABELS } from '../stat-support';

/**
 * A compact stat table (presentational, on the data grid) in the score table's look: many stats in
 * small type, one row per player, the header and the row heads staying in view as the page and the table scroll. A stat whose figure is partial, flawed or not
 * recorded is starred, with a legend, and its notes are in its header's tooltip with its
 * description. The row head comes from a `uiStatRowHead` template inside. Unsorted, the rows
 * keep their given order.
 *
 * Its width: its card is at least as wide as the layout's constrained width (where there is room),
 * the row heads taking what the stats leave; with more stats, the card grows to its whole space;
 * when even that is too narrow, every figure shortens (`89.3K`, the exact one in its tooltip); and
 * when that is still too narrow, the table scrolls sideways, the row heads staying put.
 */
@Component({
  selector: 'ui-stat-table',
  imports: [GridHeader, GridRowElement, RowTemplate, CellTemplate, DataGrid, GridColumn, HeaderTemplate, MatTooltip, NgTemplateOutlet, NumberCell, ScoreRowBar],
  templateUrl: './stat-table.html',
  styleUrl: './stat-table.scss',
})
export class StatTable<T> {
  readonly columns = input.required<readonly StatColumn[]>();
  readonly rows = input.required<readonly StatRow<T>[]>();
  /** What the row heads are, for the header over them. */
  readonly rowHeadLabel = input('Player');
  /** Whether each column's best figure stands out (as the score table's); not for rows over time. */
  readonly markBest = input(true);
  /** The table's order; none keeps the rows' own. */
  readonly sort = model<StatSort | null>(null);

  protected readonly rowHead = contentChild<StatRowHead<T>>(StatRowHead);
  private readonly grid = viewChild.required<DataGrid<StatTableRow<T>>>(DataGrid);
  private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');
  /** The widest its rows can be, px: its card as wide as its space. */
  private readonly room = signal(0);
  /**
   * The rows' width with exact figures, px, once too wide for the room (null while they fit): the
   * figures stay short until the room is that wide again. New columns or rows measure afresh.
   */
  private readonly exactWidth = linkedSignal<unknown, number | null>({
    source: () => [this.columns(), this.rows()],
    computation: () => null,
  });
  /** Every figure in short form: all or none, so they read alike. */
  protected readonly compact = computed(() => this.exactWidth() !== null);
  private readonly locale = inject(LOCALE_ID);
  protected readonly table = computed(() =>
    statTableRows(this.rows(), this.columns(), this.sort(), this.locale, this.markBest()),
  );
  protected readonly supportLabels = STAT_SUPPORT_LABELS;
  /** The kinds of limited support the shown columns have, for the legend. */
  protected readonly limits = computed(() => {
    const kinds = new Set(this.columns().map((c) => c.support ?? 'full'));
    return (['partial', 'flawed', 'none'] as const).filter((k) => kinds.has(k));
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // the room: the space's width less the card's padding and border
    const measure = () => {
      const card = getComputedStyle(this.card().nativeElement);
      const chrome = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'] as const;
      this.room.set(host.clientWidth - chrome.reduce((sum, side) => sum + (parseFloat(card[side]) || 0), 0));
    };
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(host);
      inject(DestroyRef).onDestroy(() => observer.disconnect());
    }
    // short figures once the exact ones overflow the room; exact again once the room fits them
    afterRenderEffect(() => {
      const width = this.grid().rowsWidth();
      const room = this.room();
      if (room <= 0 || width <= 0) return;
      const exact = untracked(this.exactWidth);
      if (exact === null && width > room + 0.5) this.exactWidth.set(width);
      else if (exact !== null && room >= exact) this.exactWidth.set(null);
    });
  }

  protected tooltip(column: StatColumn): string {
    return (
      [column.description, ...(column.notes ?? [])].filter(Boolean).join(' — ') || column.label
    );
  }

  protected isLimited(support: StatSupport | undefined): support is Exclude<StatSupport, 'full'> {
    return support !== undefined && support !== 'full';
  }

  /** A column's first press sorts best first: lowest first where lower is better (deaths). */
  protected readonly bestFirst = (column: StatColumn) => statBestFirst(column).direction;
  protected readonly byKey = (line: StatTableRow<T>) => line.row.key;
  protected readonly themeOf = (line: StatTableRow<T>) => line.row.theme ?? null;
}
