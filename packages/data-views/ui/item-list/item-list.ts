import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  booleanAttribute,
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
  WHOLE_LISTS,
} from '../../model';
import { EmptyTemplate, GroupHeaderTemplate, ITEM_FOCUS, ItemTemplate, PlaceholderTemplate } from '../templates/list-templates';
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
  /** The list marks the chosen item (`aria-current`), keeps it in view, and moving to an item chooses it. */
  readonly selectable = input(false, { transform: booleanAttribute });
  /** The chosen item, when the list is `selectable`. */
  readonly selected = model<T | null>(null);
  /** An item was chosen: clicked, Enter or Space on it, or (`selectable`) moved to. */
  readonly activate = output<T>();

  protected readonly itemTemplate = contentChild.required<ItemTemplate<T>>(ItemTemplate);
  protected readonly groupTemplate = contentChild(GroupHeaderTemplate);
  protected readonly emptyTemplate = contentChild(EmptyTemplate);
  protected readonly placeholderTemplate = contentChild(PlaceholderTemplate);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly probe = viewChild.required<ElementRef<HTMLElement>>('probe');
  private readonly drawnRows = viewChildren<ElementRef<HTMLElement>>('rowElement');
  private readonly stuckHeader = viewChild<ElementRef<HTMLElement>>('stuckHeader');
  /** The stuck header's height, as last drawn. */
  private readonly stuckSize = signal(0);

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
    this.groupBy() ? stuckGroup(this.rows(), this.window.rows(), this.window.offset(), this.stuckSize()) : null,
  );

  private readonly selectedTrack = computed(() => {
    const item = this.selected();
    const trackBy = this.trackBy();
    return item === null || !this.selectable() ? null : trackBy ? trackBy(item, -1) : item;
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
    // (nothing to measure without layout)
    if (!inject(WHOLE_LISTS)) {
      const sized = new ResizeObserver(measure);
      sized.observe(this.host);
      inject(DestroyRef).onDestroy(() => sized.disconnect());
    }

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

    // the chosen item in view, chosen here or elsewhere (on a map) alike
    effect(() => {
      const chosen = this.selectedTrack();
      if (chosen === null) return;
      untracked(() => {
        const index = this.indexOf(chosen);
        if (index < 0) return;
        this.focus.set(index);
        this.window.scrollToIndex(rowOfItem(this.rows(), index));
      });
    });

    afterRenderEffect(() => {
      // again whenever what is drawn changes, its items too
      this.drawn();
      this.stuckSize.set(this.stuckHeader()?.nativeElement.offsetHeight ?? 0);
      for (const { nativeElement } of this.drawnRows()) {
        this.window.measure(nativeElement, !nativeElement.classList.contains('hrs-items__group'));
      }
      // one Tab stop: the current item's focus target
      const current = this.focusIndex();
      for (const item of Array.from(this.host.querySelectorAll<HTMLElement>('.item-list__row > .hrs-items__item'))) {
        const target = focusTarget(item);
        if (target !== item) item.removeAttribute('tabindex');
        target.tabIndex = Number(item.getAttribute('item-index')) === current ? 0 : -1;
      }
      const pending = this.pendingFocus();
      if (pending === null) return;
      const item = this.itemElement(pending);
      if (item) {
        focusTarget(item).focus();
        this.pendingFocus.set(null);
      }
    });
  }

  protected isSelected(entry: DrawnItem<T>): boolean {
    const selected = this.selectedTrack();
    return selected !== null && entry.item !== null && selected === (this.trackBy() ? entry.track : entry.item);
  }

  /** A click on an item chooses it; not one on another control in it (a toggle beside its link). */
  protected onClick(event: MouseEvent, entry: DrawnItem<T>): void {
    const item = event.currentTarget as HTMLElement;
    const control = (event.target as HTMLElement).closest(CONTROLS);
    if (control && item.contains(control) && control !== focusTarget(item)) return;
    this.choose(entry.index);
  }

  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const item = target.closest<HTMLElement>('.hrs-items__item');
    // only from an item's focus target, not from another control in it
    if (!item || !this.host.contains(item) || focusTarget(item) !== target) return;
    const index = Number(item.getAttribute('item-index'));
    if (event.key === 'Enter' || event.key === ' ') {
      // a link or a button chooses it by its own click
      if (target !== item) return;
      event.preventDefault();
      this.choose(index);
      return;
    }
    const move = listMoveOf(event.key);
    if (move === null) return;
    event.preventDefault();
    const to = listMove(this.rows(), this.count(), index, move);
    if (to < 0) return;
    this.focus.set(to);
    this.window.scrollToIndex(rowOfItem(this.rows(), to));
    // a list that marks the chosen one: moving chooses
    if (this.selectable()) this.choose(to);
    // now when it is drawn already, else once it is
    const next = this.itemElement(to);
    if (next) focusTarget(next).focus();
    else this.pendingFocus.set(to);
  }

  private choose(index: number): void {
    this.focus.set(index);
    const item = itemAt(this.items(), index);
    if (item === null) return;
    if (this.selectable()) this.selected.set(item);
    this.activate.emit(item);
  }

  private itemElement(index: number): HTMLElement | null {
    return this.host.querySelector<HTMLElement>(`.item-list__row > [item-index="${index}"]`);
  }

  /** Where the item tracked as `track` is, among all of them (-1 when not, or not loaded). */
  private indexOf(track: unknown): number {
    const items = this.items();
    const trackBy = this.trackBy();
    const count = itemCount(items);
    for (let index = 0; index < count; index++) {
      const item = itemAt(items, index);
      if (item !== null && (trackBy ? trackBy(item, index) : item) === track) return index;
    }
    return -1;
  }
}

/** What inside an item does something of its own when clicked. */
const CONTROLS = 'a[href], button, input, select, textarea, [role="button"]';

/** What in an item takes the focus: its `hrsItemFocus` element, else the item itself. */
function focusTarget(item: HTMLElement): HTMLElement {
  return item.querySelector<HTMLElement>(`[${ITEM_FOCUS}]`) ?? item;
}
