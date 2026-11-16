import { inject, Service } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import type { VirtualItem } from '@tanstack/angular-virtual';

/** Where a page was scrolled to, and each of its lists' measured rows, for when it comes back. */
export interface VirtualScrollState {
  readonly offset: number;
  readonly measurements: readonly VirtualItem[];
  /** The size the rows not drawn yet were taken to be. */
  readonly size: number | null;
}

/**
 * Each page's lists' scroll states, by the page's address and the list's place among the page's
 * lists (the order they are made in), kept while the app is open.
 */
@Service()
export class VirtualScrollMemory {
  private readonly states = new Map<string, VirtualScrollState>();
  private made = new Map<string, number>();

  constructor() {
    // a new page: its lists count from the first again
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) this.made = new Map();
    });
  }

  /** The key of a list made now on the page at `path`: the page and its place among the page's lists. */
  keyFor(path: string): string {
    const place = this.made.get(path) ?? 0;
    this.made.set(path, place + 1);
    return `${path}#${place}`;
  }

  get(key: string): VirtualScrollState | undefined {
    return this.states.get(key);
  }

  set(key: string, state: VirtualScrollState): void {
    this.states.set(key, state);
  }
}
