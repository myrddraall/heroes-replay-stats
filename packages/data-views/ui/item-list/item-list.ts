import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  contentChild,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  isListDataSource,
  itemAt,
  itemCount,
  listMove,
  listMoveOf,
  listRows,
  rowOfItem,
  stuckGroup,
  type ListItems,
} from '../../model';
import { EmptyTemplate, GroupHeaderTemplate, ItemTemplate, PlaceholderTemplate } from '../templates/list-templates';
import { injectVirtualWindow } from '../virtual/virtual-window';

/** The item a drawn row shows: its index, the item (null while it loads) and what tracks it. */
interface DrawnItem<T> {
  readonly index: number;
  readonly item: T | null;
  readonly track: unknown;
}

/**
 * A list of cards or rows (presentational). The page gives the items and draws each one with
 * its `*hrsItem` template; only the rows in the page's view are drawn, in the page's own scroll.
 * Columns, gaps and group headers follow the custom properties set on the element (the
 * ItemList spec).
 */
@Component({
  selector: 'hrs-item-list',
  imports: [NgTemplateOutlet],
  templateUrl: './item-list.html',
  styleUrl: './item-list.scss',
  host: {
    role: 'list',
    '[style.height.px]': 'window.totalSize()',
    '[style.--hrs-list-columns]': 'columns()',
    '(keydown)': 'onKey($event)',
  },
})
export class ItemList<T> {
  /** The items: all of them, or a source that loads them in ranges. */
  readonly items = input.required<ListItems<T>>();
  /** What stays the same for an item as the items change (without it, the item itself). */
  readonly trackBy = input<(item: T, index: number) => unknown>();
  /** The group an item is in, null for none: each group starts with its header. */
  readonly groupBy = input<(item: T, index: number) => string | null>();
  /** The chosen item. */
  readonly selected = model<T | null>(null);
  /** An item was chosen (clicked, or Enter or Space on it). */
  readonly activate = output<T>();

  protected readonly itemTemplate = contentChild.required<ItemTemplate<T>>(ItemTemplate);
  protected readonly groupTemplate = contentChild(GroupHeaderTemplate);
  protected readonly emptyTemplate = contentChild(EmptyTemplate);
  protected readonly placeholderTemplate = contentChild(PlaceholderTemplate);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly probe = viewChild.required<ElementRef<HTMLElement>>('probe');
  private readonly drawnRows = viewChildren<ElementRef<HTMLElement>>('rowElement');

  /** The list's width, and what the custom properties come to in px. */
  private readonly size = signal({ width: 0, itemMinWidth: 0, gap: 12, placeholder: 120 });

  protected readonly count = computed(() => itemCount(this.items()));

  /** As many columns as the narrowest a column may be allows. */
  protected readonly columns = computed(() => {
    const { width, itemMinWidth, gap } = this.size();
    return itemMinWidth > 0 ? Math.max(1, Math.floor((width + gap) / (itemMinWidth + gap))) : 1;
  });

  protected readonly rows = computed(() => {
    const items = this.items();
    const by = this.groupBy();
    const groupOf = by
      ? (index: number) => {
          const item = itemAt(items, index);
          return item === null ? null : by(item, index);
        }
      : undefined;
    return listRows(itemCount(items), this.columns(), groupOf);
  });

  protected readonly window = injectVirtualWindow(this.host, () => {
    const rows = this.rows();
    const { gap, placeholder } = this.size();
    return { count: rows.length, gap, estimate: placeholder, key: (i: number) => rows[i]?.key ?? `${i}` };
  });

  /** The rows to draw now, each with its items. */
  protected readonly drawn = computed(() => {
    const rows = this.rows();
    const items = this.items();
    const trackBy = this.trackBy();
    const top = this.window.start();
    return this.window.rows().flatMap((v) => {
      const row = rows[v.index];
      if (!row) return [];
      const shown: DrawnItem<T>[] = [];
      if (row.kind === 'items') {
        for (let index = row.start; index < row.start + row.count; index++) {
          const item = itemAt(items, index);
          shown.push({ index, item, track: item !== null && trackBy ? trackBy(item, index) : index });
        }
      }
      return [{ index: v.index, key: v.key, y: v.start - top, row, items: shown }];
    });
  });

  /** The header that stays at the top of the view while its group's items pass under it. */
  protected readonly stuck = computed(() =>
    this.groupBy() ? stuckGroup(this.rows(), this.window.rows(), this.window.offset()) : null,
  );

  private readonly selectedTrack = computed(() => {
    const item = this.selected();
    const trackBy = this.trackBy();
    return item === null ? null : trackBy ? trackBy(item, -1) : item;
  });

  /** The item Tab lands on (the one last moved to or chosen). */
  private readonly focus = signal(0);
  protected readonly focusIndex = computed(() => Math.min(this.focus(), Math.max(0, this.count() - 1)));
  /** An item to move the focus to once it is drawn. */
  private readonly pendingFocus = signal<number | null>(null);

  constructor() {
    // the list's width and what the custom properties come to, again as they change
    const measure = () => {
      const probe = this.probe().nativeElement;
      this.size.set({
        width: this.host.clientWidth,
        itemMinWidth: probe.offsetWidth,
        gap: parseFloat(getComputedStyle(probe).marginLeft) || 0,
        placeholder: probe.offsetHeight || 120,
      });
    };
    const sized = new ResizeObserver(measure);
    sized.observe(this.host);
    inject(DestroyRef).onDestroy(() => sized.disconnect());

    // a source loads the items the drawn rows show
    effect(() => {
      const items = this.items();
      if (!isListDataSource(items)) return;
      let start = Infinity;
      let end = -Infinity;
      for (const { row } of this.drawn()) {
        if (row.kind !== 'items') continue;
        start = Math.min(start, row.start);
        end = Math.max(end, row.start + row.count);
      }
      if (start < end) untracked(() => items.load(start, end));
    });

    afterRenderEffect(() => {
      for (const { nativeElement } of this.drawnRows()) {
        this.window.measure(nativeElement, !nativeElement.classList.contains('hrs-items__group'));
      }
      const pending = this.pendingFocus();
      if (pending === null) return;
      const element = this.host.querySelector<HTMLElement>(`[item-index="${pending}"]`);
      if (element) {
        element.focus({ preventScroll: true });
        this.pendingFocus.set(null);
      }
    });
  }

  protected isSelected(entry: DrawnItem<T>): boolean {
    const selected = this.selectedTrack();
    return selected !== null && entry.item !== null && selected === (this.trackBy() ? entry.track : entry.item);
  }

  protected choose(entry: DrawnItem<T>): void {
    this.focus.set(entry.index);
    if (entry.item === null) return;
    this.selected.set(entry.item);
    this.activate.emit(entry.item);
  }

  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    // only from an item itself, not from a control inside it
    if (!target.matches('.hrs-items__item')) return;
    const index = Number(target.getAttribute('item-index'));
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const entry = this.drawn()
        .flatMap((d) => d.items)
        .find((e) => e.index === index);
      if (entry) this.choose(entry);
      return;
    }
    const move = listMoveOf(event.key);
    if (move === null) return;
    event.preventDefault();
    const to = listMove(this.rows(), this.count(), index, move);
    if (to < 0) return;
    this.focus.set(to);
    this.window.scrollToIndex(rowOfItem(this.rows(), to));
    // now when it is drawn already, else once it is
    const element = this.host.querySelector<HTMLElement>(`[item-index="${to}"]`);
    if (element) element.focus();
    else this.pendingFocus.set(to);
  }
}
