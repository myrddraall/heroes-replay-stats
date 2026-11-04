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
import { MatSort, MatSortHeader, type Sort } from '@angular/material/sort';
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
import { GridColumn } from './grid-column';

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
 * A table of data (presentational): the page gives the items and declares the columns
 * (`hrs-column`) inside it. Only the rows in the page's view are drawn; the grid sits in the page
 * at its full height and never scrolls up and down itself. Its header row stays at the top of the
 * view; wider than its space, it scrolls sideways inside itself, the first column staying put.
 * Its look is the theme's (hrs-grid__*) and the custom properties the page sets (the DataGrid spec).
 */
@Component({
  selector: 'hrs-data-grid',
  imports: [MatSort, MatSortHeader, NgTemplateOutlet],
  templateUrl: './data-grid.html',
  styleUrl: './data-grid.scss',
  host: {
    role: 'table',
    '[attr.aria-rowcount]': 'count() + 1',
    '[attr.aria-colcount]': 'columns().length',
    '[class.is-scrolled]': 'scrolled()',
  },
})
export class DataGrid<T> {
  /** The rows' items: all of them, or a source that loads them in ranges. */
  readonly items = input.required<ListItems<T>>();
  /** What stays the same for an item as the items change (without it, its place). */
  readonly trackBy = input<(item: T, index: number) => unknown>();
  /** The group an item is in, null for none: each group starts with its header row. */
  readonly groupBy = input<(item: T, index: number) => string | null>();
  /** A row's theme (a team's), its `data-theme`: its colours follow it. */
  readonly rowTheme = input<(item: T, index: number) => string | null>();
  /** The order the items are in; the page sorts them. Pressing a sortable header changes it. */
  readonly sort = model<GridSort | null>(null);
  /** The direction a header's first press sorts in. */
  readonly sortStart = input<'asc' | 'desc'>('asc');

  protected readonly columns = contentChildren(GridColumn);
  protected readonly groupTemplate = contentChild(GroupHeaderTemplate);
  protected readonly emptyTemplate = contentChild(EmptyTemplate);

  private readonly probe = viewChild.required<ElementRef<HTMLElement>>('probe');
  private readonly rowsBox = viewChild<ElementRef<HTMLElement>>('rowsBox');
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');
  private readonly drawnRows = viewChildren<ElementRef<HTMLElement>>('rowElement');

  protected readonly count = computed(() => itemCount(this.items()));
  /** The column whose cells name their rows: the one marked, else the first. */
  protected readonly rowHeaderColumn = computed(() => {
    const columns = this.columns();
    return columns.find((c) => c.rowHeader()) ?? columns[0];
  });
  /** The columns' tracks as declared. */
  protected readonly tracks = computed(() =>
    this.columns()
      .map((c) => c.width())
      .join(' '),
  );
  /** The columns' widths as laid out, in px, for the header row (outside the rows' grid). */
  protected readonly headTracks = signal('');
  protected readonly headWidth = signal(0);
  /** Scrolled sideways: the first column stays put. */
  protected readonly scrolled = signal(false);

  /** What the custom properties come to in px: a row's height (until measured) and the gap. */
  private readonly size = signal({ row: 40, gap: 0 });

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

  protected readonly matSortActive = computed(() => this.sort()?.column ?? '');
  protected readonly matSortDirection = computed(() => this.sort()?.direction ?? '');

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
      afterRenderEffect(() => {
        const box = this.rowsBox()?.nativeElement;
        if (box) sized.observe(box);
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
  protected text(item: T, column: GridColumn): unknown {
    return (item as Record<string, unknown>)[column.name()] ?? '';
  }

  protected onSort(sort: Sort): void {
    this.sort.set(sort.direction ? { column: sort.active, direction: sort.direction } : null);
  }

  protected onScroll(): void {
    const body = this.body()?.nativeElement;
    if (!body) return;
    const head = body.previousElementSibling as HTMLElement | null;
    if (head) head.scrollLeft = body.scrollLeft;
    this.scrolled.set(body.scrollLeft > 0);
  }

  /** The header row takes the widths the rows' grid laid its columns out at. */
  private copyTracks(): void {
    const box = this.rowsBox()?.nativeElement;
    if (!box) return;
    this.headTracks.set(getComputedStyle(box).gridTemplateColumns);
    this.headWidth.set(box.offsetWidth);
  }
}
