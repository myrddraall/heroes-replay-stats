import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  contentChild,
  contentChildren,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  type GridSort,
  isListDataSource,
  itemAt,
  itemCount,
  listRows,
  type ListItems,
  WHOLE_LISTS,
} from '../../model';
import { EmptyTemplate, GroupHeaderTemplate } from '../templates/list-templates';
import { injectVirtualWindow } from '../virtual/virtual-window';
import { type AttachableGrid, DataGridColumn, type HeaderWidth } from './grid-column';
import { GridRow, GridRowHeight, RowTemplate } from '../grid-row/grid-row';

/** A drawn row: a group's header, a row of an item (null while it loads). */
type DrawnRow<T> =
  | { readonly kind: 'group'; readonly key: string; readonly group: string; readonly index: number }
  | {
      readonly kind: 'item';
      readonly key: string;
      readonly index: number;
      readonly item: T | null;
      readonly theme: string | null;
    };

/**
 * A table of data (presentational): the page gives the items and declares the columns inside it
 * (`hrs-column`, or column kinds), and, optionally, its rows' look (`*hrsRow`). It lays out rows and
 * cells and nothing else: no header, no look of its own. Only the rows in the page's view are
 * drawn; it sits in the page at its full height and never scrolls up and down itself; wider than
 * its space, it scrolls sideways inside itself, the first column staying put.
 *
 * Parts attach to it by reference, as a datepicker's toggle does (`<hrs-grid-header [for]="grid" />`
 * with `<hrs-data-grid #grid>`): it gives them its columns (and which are shown, in what order), the
 * columns' widths as laid out, its sideways scroll, and its sort; a header gives it back the widths
 * its cells want and its row, which the grid owns for screen readers (`aria-owns`).
 */
@Component({
  selector: 'hrs-data-grid',
  exportAs: 'hrsDataGrid',
  imports: [GridRow, NgTemplateOutlet],
  providers: [{ provide: GridRowHeight, useExisting: DataGrid }],
  templateUrl: './data-grid.html',
  styleUrl: './data-grid.scss',
  host: {
    role: 'table',
    '[attr.aria-rowcount]': 'count() + headers().length',
    '[attr.aria-colcount]': 'shownColumns().length',
    '[attr.aria-owns]': "headers().join(' ') || null",
    '[class.is-scrolled]': 'scrolled()',
  },
})
export class DataGrid<T> implements GridRowHeight, AttachableGrid {
  /** The rows' items: all of them, or a source that loads them in ranges. */
  readonly items = input.required<ListItems<T>>();
  /** What stays the same for an item as the items change (without it, its place). */
  readonly trackBy = input<(item: T, index: number) => unknown>();
  /** The group an item is in, null for none: each group starts with its header row. */
  readonly groupBy = input<(item: T, index: number) => string | null>();
  /** A row's theme (a team's), its `theme`: its colours follow it. */
  readonly rowTheme = input<(item: T, index: number) => string | null>();
  /** The order the items are in; the page sorts them. An attached header changes it. */
  readonly sort = model<GridSort | null>(null);
  /** The direction a header's first press on a column sorts in, when the column doesn't say. */
  readonly sortStart = input<'asc' | 'desc'>('asc');
  /**
   * The columns shown, by name, in this order (as Material's table's `displayedColumns`); null
   * shows them all as declared. A column setup attached to the grid sets it.
   */
  readonly displayedColumns = model<readonly string[] | null>(null);

  /** Every column declared in it, shown or not. */
  readonly columns = contentChildren(DataGridColumn);
  /** The columns shown, in order. */
  readonly shownColumns = computed(() => {
    const columns = this.columns();
    const names = this.displayedColumns();
    if (names === null) return columns;
    return names.flatMap((name) => columns.find((c) => c.name() === name) ?? []);
  });
  protected readonly rowTemplate = contentChild(RowTemplate);
  protected readonly groupTemplate = contentChild(GroupHeaderTemplate);
  protected readonly emptyTemplate = contentChild(EmptyTemplate);

  private readonly probe = viewChild.required<ElementRef<HTMLElement>>('probe');
  private readonly rowsBox = viewChild<ElementRef<HTMLElement>>('rowsBox');
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');
  /** The sizing row's boxes, one a column, each as wide as its column. */
  private readonly columnBoxes = viewChildren<string, ElementRef<HTMLElement>>('columnBox', {
    read: ElementRef,
  });
  private readonly drawnRows = viewChildren<string, ElementRef<HTMLElement>>('rowElement', {
    read: ElementRef,
  });

  protected readonly count = computed(() => itemCount(this.items()));
  /** The column whose cells name their rows: the one marked, else the first. */
  protected readonly rowHeaderColumn = computed(() => {
    const columns = this.shownColumns();
    return columns.find((c) => c.rowHeader()) ?? columns[0];
  });
  /** The columns' tracks as declared. */
  protected readonly tracks = computed(() =>
    this.shownColumns()
      .map((c) => c.width())
      .join(' '),
  );
  /** The columns' widths as laid out (`grid-template-columns`, in px), for a header to line up with. */
  readonly columnTracks = signal('');
  /** The rows' width as laid out, px. */
  readonly rowsWidth = signal(0);
  /** How far it is scrolled sideways, px, for a header to follow. */
  readonly scrollLeft = signal(0);
  /** Scrolled sideways: the first column stays put. */
  readonly scrolled = computed(() => this.scrollLeft() > 0);
  /** The widths attached headers' cells want, px, by column. */
  private readonly headerWidths = signal<Readonly<Record<string, HeaderWidth>>>({});
  /** The ids of the attached headers' rows. */
  protected readonly headers = signal<readonly string[]>([]);

  /** What the custom properties come to in px: a row's height (until measured) and the gap. */
  private readonly size = signal({ row: 40, gap: 0 });
  /** A row's height (`--hrs-grid-row-height`) in px, as measured: what each row gives its cells. */
  readonly rowHeight = computed(() => this.size().row);

  private readonly rows = computed(() => {
    const items = this.items();
    const by = this.groupBy();
    const groupOf = by
      ? (index: number) => {
          const item = itemAt(items, index);
          return item === null ? null : by(item, index);
        }
      : undefined;
    return listRows(itemCount(items), 1, groupOf);
  });

  protected readonly window = injectVirtualWindow(
    () => this.rowsBox()!.nativeElement,
    () => {
      const rows = this.rows();
      const { row, gap } = this.size();
      return { count: rows.length, gap, estimate: row, key: (i: number) => rows[i]?.key ?? `${i}` };
    },
  );

  /** The rows to draw now. */
  protected readonly drawn = computed(() => {
    const rows = this.rows();
    const items = this.items();
    const trackBy = this.trackBy();
    const theme = this.rowTheme();
    return this.window.rows().flatMap((v): DrawnRow<T>[] => {
      const row = rows[v.index];
      if (!row) return [];
      if (row.kind === 'group') return [{ kind: 'group', key: `${v.key}`, group: row.group, index: v.index }];
      const item = itemAt(items, row.start);
      const key = item !== null && trackBy ? `${trackBy(item, row.start)}` : `${v.key}`;
      return [{ kind: 'item', key, index: row.start, item, theme: item !== null && theme ? theme(item, row.start) : null }];
    });
  });

  /** The space above the first drawn row: the rows not drawn there. */
  protected readonly above = computed(() => (this.window.rows()[0]?.start ?? this.window.start()) - this.window.start());


  constructor() {
    const whole = inject(WHOLE_LISTS);
    // the custom properties in px, the header row's widths, again as the grid's size changes
    const measure = () => {
      const probe = this.probe().nativeElement;
      this.size.set({
        row: probe.offsetHeight || 40,
        gap: parseFloat(getComputedStyle(probe).marginLeft) || 0,
      });
      this.copyTracks();
    };
    if (!whole) {
      const sized = new ResizeObserver(measure);
      // the rows, and each column's box in the sizing row: the columns can change width while the
      // rows keep theirs (filling their space)
      afterRenderEffect(() => {
        const box = this.rowsBox()?.nativeElement;
        if (box) sized.observe(box);
        for (const { nativeElement } of this.columnBoxes()) sized.observe(nativeElement);
      });
      inject(DestroyRef).onDestroy(() => sized.disconnect());
    }

    // a source loads the rows drawn
    effect(() => {
      const items = this.items();
      if (!isListDataSource(items)) return;
      const drawn = this.drawn().filter((d) => d.kind === 'item');
      if (drawn.length === 0) return;
      const start = drawn[0]!.index;
      const end = drawn.at(-1)!.index + 1;
      untracked(() => items.load(start, end));
    });

    afterRenderEffect(() => {
      this.drawn();
      this.tracks();
      for (const { nativeElement } of this.drawnRows()) {
        this.window.measure(nativeElement, !nativeElement.classList.contains('hrs-grid__group'));
      }
      this.copyTracks();
    });
  }

  /** A cell's text without a template: the item's field of the column's name. */
  protected text(item: T, column: DataGridColumn): unknown {
    return (item as Record<string, unknown>)[column.name()] ?? '';
  }

  /** A header attaches its row (its id), for screen readers to read it as this table's; returns its detaching. */
  attachHeader(rowId: string): () => void {
    this.headers.update((ids) => [...ids, rowId]);
    return () => this.headers.update((ids) => ids.filter((id) => id !== rowId));
  }

  /** The widths an attached header's cells want, px, by column name: the columns sized by them as by their cells. */
  setHeaderWidths(widths: Readonly<Record<string, HeaderWidth>>): void {
    const current = this.headerWidths();
    const names = Object.keys(widths);
    const same = (a: HeaderWidth | undefined, b: HeaderWidth | undefined) => a?.min === b?.min && a?.max === b?.max;
    if (names.length === Object.keys(current).length && names.every((n) => same(current[n], widths[n]))) return;
    this.headerWidths.set(widths);
  }

  /**
   * A column's header widths as empty boxes for the sizing row: one its least width, the rest its
   * most in pieces no wider, so the column takes them as it takes a wrapping label (no narrower
   * than the least, as wide as the most where there is room). None without a header.
   */
  protected sizePieces(column: DataGridColumn): readonly number[] {
    const width = this.headerWidths()[column.name()];
    if (!width || width.min <= 0) return [];
    const rest = Math.max(0, width.max - width.min);
    const count = Math.ceil(rest / width.min);
    return [width.min, ...Array.from({ length: count }, () => rest / count)];
  }

  protected onScroll(): void {
    const body = this.body()?.nativeElement;
    if (body) this.scrollLeft.set(body.scrollLeft);
  }

  /** The widths the rows' grid laid its columns out at, for attached headers. */
  private copyTracks(): void {
    const box = this.rowsBox()?.nativeElement;
    if (!box) return;
    this.columnTracks.set(getComputedStyle(box).gridTemplateColumns);
    this.rowsWidth.set(box.offsetWidth);
  }
}
