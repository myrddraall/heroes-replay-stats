import { Component, computed, signal } from '@angular/core';
import type { ListDataSource } from '@myrddraall/heroes-replay-stats-data-views/model';
import { EmptyTemplate, GroupHeaderTemplate, ItemList, ItemTemplate } from '@myrddraall/heroes-replay-stats-data-views/ui';
import { MatButton } from '@angular/material/button';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';

interface Card {
  readonly id: number;
  readonly title: string;
  readonly day: string;
}

interface Line {
  readonly id: number;
  readonly who: string;
  readonly text: string;
}

/** The same numbers on every load: a check can compare runs. */
function numbers(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const words = 'push the core lane now group up at the boss gank top they have no ult wait for the camp'.split(' ');

function cards(count: number): Card[] {
  const next = numbers(7);
  let day = 1;
  return Array.from({ length: count }, (_, id) => {
    if (next() < 0.05) day++;
    return { id, title: `Match ${id + 1}`, day: `Day ${day}` };
  });
}

function lines(count: number): Line[] {
  const next = numbers(11);
  return Array.from({ length: count }, (_, id) => ({
    id,
    who: `Player ${1 + Math.floor(next() * 10)}`,
    text: Array.from({ length: 2 + Math.floor(next() * next() * 60) }, () => words[Math.floor(next() * words.length)]).join(' '),
  }));
}

/** Items that arrive a page at a time, a little after they are asked for. */
class SlowSource implements ListDataSource<Card> {
  readonly count = signal(1000);
  private readonly pages = signal<ReadonlyMap<number, readonly Card[]>>(new Map());
  private readonly asked = new Set<number>();

  item(index: number): Card | null {
    return this.pages().get(Math.floor(index / 50))?.[index % 50] ?? null;
  }

  load(start: number, end: number): void {
    for (let page = Math.floor(start / 50); page * 50 < end; page++) {
      if (this.asked.has(page)) continue;
      this.asked.add(page);
      setTimeout(() => {
        const items = Array.from({ length: 50 }, (_, i) => ({ id: page * 50 + i, title: `Loaded ${page * 50 + i + 1}`, day: '' }));
        this.pages.update((pages) => new Map(pages).set(page, items));
      }, 600);
    }
  }
}

/**
 * Long lists on one page, in the page's own scroll, each drawing only what is in view: the UI
 * area's Tests › Lists (`/ui/tests/lists`), its section's side nav in the shell's left-hand drawer.
 */
@Component({
  selector: 'hrs-lists-check-page',
  imports: [
    MatButton,
    Layout,
    ItemList,
    ItemTemplate,
    GroupHeaderTemplate,
    EmptyTemplate,
  ],
  templateUrl: './lists-check-page.html',
  styleUrl: './lists-check-page.scss',
})
export class ListsCheckPage {
  protected readonly cards = cards(600);
  protected readonly lines = lines(400);
  protected readonly source = new SlowSource();
  protected readonly noItems: readonly Card[] = [];

  /** Paragraphs above the lists, to move them down the page. */
  protected readonly extra = signal(0);
  protected readonly extraLines = computed(() => Array.from({ length: this.extra() }, (_, i) => i));

  protected readonly chosen = signal<Card | null>(null);
  protected readonly byId = (card: Card) => card.id;
  protected readonly byDay = (card: Card) => card.day;
  protected readonly lineId = (line: Line) => line.id;
}
