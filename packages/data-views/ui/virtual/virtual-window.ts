import { CdkScrollable } from '@angular/cdk/scrolling';
import { Location } from '@angular/common';
import { afterNextRender, computed, DestroyRef, inject, type Signal, signal, untracked } from '@angular/core';
import { injectVirtualizer, injectWindowVirtualizer, type VirtualItem } from '@tanstack/angular-virtual';
import { WHOLE_LISTS } from '../../model';
import { VirtualScrollMemory } from './virtual-scroll-memory';

/** The attribute a drawn row carries its index in, for measuring it. */
export const ROW_INDEX = 'row-index';

export interface VirtualWindowOptions {
  /** How many rows there are. */
  readonly count: number;
  /** Between rows, in px. */
  readonly gap: number;
  /** A row's height until the first one is measured, in px. */
  readonly estimate: number;
  /** Each row's key, so a row keeps its measured size when rows come and go before it. */
  readonly key?: (index: number) => string;
}

/** The rows of a long list that are in the page's view, and where to draw them. */
export interface VirtualWindow {
  /** The rows to draw now. */
  readonly rows: Signal<VirtualItem[]>;
  /** All the rows' height together, in px: the list's own height. */
  readonly totalSize: Signal<number>;
  /** Where the list starts within what its scroller scrolls: take it off a row's start to place it. */
  readonly start: Signal<number>;
  /** How far the scroller is scrolled. */
  readonly offset: Signal<number>;
  /** The scroller's padding at the top: a sticky header set this far up sits at its very top. */
  readonly inset: Signal<number>;
  /**
   * Measures a drawn row (it carries its index in `ROW_INDEX`); unless `typical` is false (a group's
   * header), its size stands for the rows not drawn yet until they are.
   */
  measure(row: HTMLElement, typical?: boolean): void;
  /** Brings a row into the view. */
  scrollToIndex(index: number): void;
}

/**
 * The window of a long list on its host (`host`, or what gives it once drawn): only the rows in the page's view (and a few
 * either side) are drawn. It scrolls with whatever scrolls it on the page, found once it is on
 * the page: the nearest of its parents that scrolls (a panel's body), else the app's scroller
 * (`CdkScrollable`, the shell's page); the window's own scroll when there is none. It follows where the
 * list sits as what is above it changes, takes the first row it measures as the size of the rows
 * not drawn yet, and when the page comes back returns it to where it was. Call it in a
 * component's injection context.
 */
export function injectVirtualWindow(
  host: HTMLElement | (() => HTMLElement),
  options: () => VirtualWindowOptions,
): VirtualWindow {
  if (inject(WHOLE_LISTS)) return wholeWindow(options);
  const outer = inject(CdkScrollable, { optional: true })?.getElementRef().nativeElement ?? null;
  /** What scrolls the list, once it is on the page. */
  const scroller = signal<HTMLElement | undefined>(undefined);
  const memory = inject(VirtualScrollMemory);
  const key = memory.keyFor(inject(Location).path());
  const saved = memory.get(key);
  const start = signal(0);
  /** The scroller's padding at the top, which something sticky stays below. */
  const inset = signal(0);
  /** The first drawn row's height: the size of the rows not drawn yet. */
  const firstSize = signal<number | null>(saved?.size ?? null);

  const common = () => {
    const { count, gap, estimate, key: rowKey } = options();
    const size = firstSize() ?? estimate;
    return {
      count,
      gap,
      estimateSize: () => size,
      ...(rowKey ? { getItemKey: rowKey } : {}),
      overscan: 4,
      scrollMargin: start(),
      indexAttribute: ROW_INDEX,
      // the exact height, not rounded: rows of 31.4px add up
      measureElement: (element: Element, entry: ResizeObserverEntry | undefined) =>
        entry?.borderBoxSize[0]?.blockSize ?? element.getBoundingClientRect().height,
      // only the list is drawn again as it scrolls, not the whole app
      useApplicationRefTick: false,
      // measured on the next frame, so a row resizing while measured never loops the observer
      useAnimationFrameWithResizeObserver: true,
      ...(saved ? { initialMeasurementsCache: [...saved.measurements], initialOffset: saved.offset } : {}),
    };
  };
  const virtualizer = outer
    ? injectVirtualizer(() => ({ ...common(), scrollElement: scroller() }))
    : injectWindowVirtualizer(() => common());

  // Where the list starts on the page: again whenever it, its scroller or the page in it changes size.
  // What scrolls it can change as the page around it does (a panel that opens gets more in it than
  // it shows): looked for again each time.
  const place = () => {
    const box = outer ? scrollingParent(hostOf(), outer) : undefined;
    const was = untracked(scroller);
    if (box && box !== was) {
      sized.observe(box);
      for (const child of Array.from(box.children)) sized.observe(child);
      scroller.set(box);
    }
    inset.set(box ? parseFloat(getComputedStyle(box).paddingTop) || 0 : 0);
    const top = hostOf().getBoundingClientRect().top;
    start.set(box ? top - box.getBoundingClientRect().top + box.scrollTop : top + window.scrollY);
  };
  const hostOf = () => (typeof host === 'function' ? host() : host);
  const sized = new ResizeObserver(place);
  afterNextRender(() => {
    sized.observe(hostOf());
    // its parents too: one of them taking on more than it shows makes it the scroller
    for (let parent = hostOf().parentElement; outer && parent && parent !== outer; parent = parent.parentElement) {
      sized.observe(parent);
    }
    place();
    const box = untracked(scroller);
    // back where the page was
    if (saved) {
      if (box) box.scrollTop = saved.offset;
      else window.scrollTo({ top: saved.offset });
    }
  });
  inject(DestroyRef).onDestroy(() => {
    sized.disconnect();
    // the virtualizer's last offset: by now the rows are gone and the scroller is back at the top
    const offset = untracked(() => virtualizer.scrollOffset()) ?? 0;
    memory.set(key, { offset, measurements: virtualizer.takeSnapshot(), size: untracked(firstSize) });
  });

  // none while the list is wholly out of the view (the virtualizer always gives its first rows)
  const rows = computed(() => {
    const drawn = virtualizer.getVirtualItems();
    const view = virtualizer.scrollRect();
    const offset = virtualizer.scrollOffset() ?? 0;
    if (!view) return drawn;
    const near = view.height / 2;
    const top = start();
    const out = offset + view.height < top - near || offset > top + virtualizer.getTotalSize() + near;
    return out ? [] : drawn;
  });

  return {
    rows,
    totalSize: virtualizer.getTotalSize,
    start,
    offset: computed(() => virtualizer.scrollOffset() ?? 0),
    inset,
    measure: (row, typical = true) => {
      virtualizer.measureElement(row);
      if (typical && firstSize() === null && row.offsetHeight > 0) firstSize.set(row.offsetHeight);
    },
    // the least scroll that shows the row: the virtualizer's own sends the last row to the
    // scroller's very end, past whatever follows the list on the page
    scrollToIndex: (index) => {
      const row = untracked(virtualizer.measurementsCache)[index];
      const offset = untracked(virtualizer.scrollOffset) ?? 0;
      const view = untracked(virtualizer.scrollRect)?.height ?? 0;
      if (!row) return;
      if (row.start < offset) virtualizer.scrollToOffset(row.start);
      else if (row.end > offset + view) virtualizer.scrollToOffset(row.end - view);
    },
  };
}

/** Every row drawn, each the estimated height (`WHOLE_LISTS`: where there is no layout). */
function wholeWindow(options: () => VirtualWindowOptions): VirtualWindow {
  const rows = computed(() => {
    const { count, gap, estimate, key } = options();
    return Array.from({ length: count }, (_, index): VirtualItem => {
      const start = index * (estimate + gap);
      return { index, key: key?.(index) ?? index, start, end: start + estimate, size: estimate, lane: 0 };
    });
  });
  return {
    rows,
    totalSize: computed(() => rows().at(-1)?.end ?? 0),
    start: signal(0),
    offset: signal(0),
    inset: signal(0),
    measure: () => undefined,
    scrollToIndex: () => undefined,
  };
}

/**
 * The nearest of `element`'s parents that scrolls up and down, up to `outer` (the app's scroller,
 * which it falls back to). An element that only hides what overflows sideways also says it
 * scrolls up and down, so only one with more in it than it shows counts.
 */
function scrollingParent(element: HTMLElement, outer: HTMLElement): HTMLElement {
  for (let parent = element.parentElement; parent && parent !== outer; parent = parent.parentElement) {
    const scrolls = /(auto|scroll|overlay)/.test(getComputedStyle(parent).overflowY);
    if (scrolls && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return outer;
}
