import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { heroesImages } from '@myrddraall/hero-data';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { provideWholeLists } from '@myrddraall/heroes-replay-stats-data-views/testing';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { fakeHeroData } from '@myrddraall/heroes-replay-stats-heroes/testing';
import { heroLookup, type HeroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import type { ReplaySummary } from '../../model';
import { toReplayCard } from '../replay-list-item/replay-card';
import { ReplayList } from './replay-list';

const replay: ReplaySummary = {
  id: 'r1',
  map: 'Towers of Doom',
  mode: 'storm-league',
  playedAt: '2024-06-01T18:30:00.000Z',
  importedAt: '2024-06-02T09:15:00.000Z',
  durationSeconds: 1234,
  winningTeam: 1,
  build: 85267,
  status: 'ready',
  players: [],
  recorderToonHandle: null,
  outdated: false,
};

let heroes: HeroLookup;

/** The list showing one replay, `outdated` of them imported by an earlier version. */
async function render(outdated: number) {
  const fixture = TestBed.createComponent(ReplayList);
  fixture.componentRef.setInput('cards', [toReplayCard(replay, new Set(), heroes, undefined)]);
  fixture.componentRef.setInput('loaded', true);
  fixture.componentRef.setInput('outdated', outdated);
  await fixture.whenStable();
  return fixture;
}

describe('ReplayList', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideWholeLists(), provideFakeSheets()],
    }),
  );

  beforeAll(async () => {
    heroes = heroLookup(await fakeHeroData.latest(), heroesImages());
  });

  it('offers to import again the replays an earlier version imported', async () => {
    const fixture = await render(3);
    const el: HTMLElement = fixture.nativeElement;
    const notice = el.querySelector('.outdated');
    expect(notice?.textContent?.replace(/\s+/g, ' ')).toContain(
      '3 replays were imported by an earlier version of the app',
    );
    let requested = 0;
    fixture.componentInstance.importRequested.subscribe(() => requested++);
    notice?.querySelector('button')?.click();
    expect(requested).toBe(1);
  });

  it('says nothing about it when every replay is up to date', async () => {
    const fixture = await render(0);
    expect((fixture.nativeElement as HTMLElement).querySelector('.outdated')).toBeNull();
  });
});
