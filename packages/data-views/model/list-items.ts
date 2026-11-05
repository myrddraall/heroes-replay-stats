import type { Signal } from '@angular/core';

/** Items that arrive in ranges: how many there are, each one once it has loaded. */
export interface ListDataSource<T> {
  readonly count: Signal<number>;
  /** The item at `index`, or null while it loads (read in a reactive context: it changes when it arrives). */
  item(index: number): T | null;
  /** Asks for the items from `start` up to, not including, `end`. */
  load(start: number, end: number): void;
}

/** What a data grid or item list shows: all of it at once, or a source that loads ranges. */
export type ListItems<T> = readonly T[] | ListDataSource<T>;

export function isListDataSource<T>(items: ListItems<T>): items is ListDataSource<T> {
  return !Array.isArray(items);
}

/** How many items `items` has. */
export function itemCount<T>(items: ListItems<T>): number {
  return isListDataSource(items) ? items.count() : items.length;
}

/** The item at `index`, null while a source loads it. */
export function itemAt<T>(items: ListItems<T>, index: number): T | null {
  return isListDataSource(items) ? items.item(index) : (items[index] ?? null);
}
