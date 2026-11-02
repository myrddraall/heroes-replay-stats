import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  formatStatCompact,
  ScoreCards,
  statBestFirst,
  statRanks,
  statTableRows,
  type StatColumn,
  type StatRow,
} from '@myrddraall/heroes-replay-stats-replays/ui';
import { describe, expect, it } from 'vitest';
import { awardLabel } from './score-screen';

describe('awardLabel', () => {
  it('spells an award out, keeping its abbreviations', () => {
    expect(awardLabel('MVP')).toBe('MVP');
    expect(awardLabel('MostXPContribution')).toBe('Most XP contribution');
    expect(awardLabel('HighestKillStreak')).toBe('Highest kill streak');
    expect(awardLabel('MostAltarDamageDone')).toBe('Most altar damage done');
  });
});

const kills: StatColumn = { id: 'k', label: 'Kills', format: 'integer', better: 'higher' };
const deaths: StatColumn = { id: 'd', label: 'Deaths', format: 'integer', better: 'lower' };

function row(key: string, k: number, d: number): StatRow<string> {
  return { key, group: null, values: { k, d }, data: key };
}

describe('formatStatCompact', () => {
  it('shortens counts of a thousand and up, and leaves the rest as they are', () => {
    expect(formatStatCompact(89_346, kills, 'en')).toBe('89.3K');
    expect(formatStatCompact(1_234_567, kills, 'en')).toBe('1.2M');
    expect(formatStatCompact(8_707, kills, 'en')).toBe('8.7K');
    expect(formatStatCompact(999, kills, 'en')).toBe('999');
    expect(formatStatCompact(null, kills, 'en')).toBe('–');
    expect(formatStatCompact(4_000, { format: 'duration' }, 'en')).toBe('66m 40s');
  });
});

describe('statRanks', () => {
  it('gives tied rows the same place and skips the places they take', () => {
    const rows = [row('a', 8, 0), row('b', 8, 0), row('c', 6, 0), row('d', 6, 0), row('e', 1, 0)];
    expect(statRanks(rows, 'k')).toEqual([1, 1, 3, 3, 5]);
  });
});

describe('statBestFirst', () => {
  it('ranks highest first, or lowest first where lower is better', () => {
    expect(statBestFirst(kills)).toEqual({ column: 'k', direction: 'desc' });
    expect(statBestFirst(deaths)).toEqual({ column: 'd', direction: 'asc' });
  });
});

@Component({
  imports: [ScoreCards],
  template: `<ui-score-cards
    [columns]="columns"
    [table]="table()"
    [rankBy]="rankBy()"
    (rankRequested)="rankBy.set($event)"
  />`,
})
class Cards {
  readonly columns = [kills, deaths];
  readonly rows = [row('a', 2, 5), row('b', 8, 1), row('c', 8, 3)];
  readonly rankBy = signal('k');
  readonly table = () => {
    const column = this.columns.find((c) => c.id === this.rankBy())!;
    return statTableRows(this.rows, this.columns, statBestFirst(column), 'en', true);
  };
}

function places(el: HTMLElement): string[] {
  return [...el.querySelectorAll('.card')].map(
    (card) =>
      `${card.querySelector('.card__rank')?.textContent?.trim()} ${card
        .querySelector('.stat--main')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim()}`,
  );
}

describe('ScoreCards', () => {
  it('ranks the rows by the chosen stat, best first, and re-ranks from its chips', async () => {
    const fixture = TestBed.createComponent(Cards);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(places(el)).toEqual(['1 Kills 8 (best)', '1 Kills 8 (best)', '3 Kills 2']);

    const chips = el.querySelectorAll<HTMLButtonElement>('.chip');
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');
    chips[1].click();
    await fixture.whenStable();
    expect(places(el)).toEqual(['1 Deaths 1 (best)', '2 Deaths 3', '3 Deaths 5']);
    expect(chips[1].getAttribute('aria-pressed')).toBe('true');
  });
});
