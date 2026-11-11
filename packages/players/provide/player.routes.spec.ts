import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideWholeLists } from '@myrddraall/heroes-replay-stats-data-views/testing';
import { LatestHeroData } from '@myrddraall/heroes-replay-stats-heroes/data';
import { heroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import { heroesImages } from '@myrddraall/hero-data';
import { ShellNavStore, ShellPanelsStore } from '@myrddraall/heroes-replay-stats-shell/data';
import { ReplayService } from '@myrddraall/heroes-replay-stats-replays/data';
import type { ReplaySummary } from '@myrddraall/heroes-replay-stats-replays/model';
import { PlayerGamesService, PlayerService } from '../data';
import type { PlayerGameRows, PlayerSummary } from '../model';
import { PLAYERS_ROUTES } from './routes';

const ID = '2-Hero-1-1';

const replay = (id: string, map: string): ReplaySummary => ({
  id,
  map,
  mode: 'quick-match',
  playedAt: `2024-03-0${id}T00:00:00.000Z`,
  importedAt: '2024-04-01T00:00:00.000Z',
  durationSeconds: 1200,
  winningTeam: 0,
  build: 90000,
  status: 'complete',
  players: [
    { slot: 0, toonHandle: ID, name: 'Ann', hero: 'Jaina', heroId: 'Jaina', team: 0, won: true, kind: 'player' },
    { slot: 1, toonHandle: '2-Hero-1-2', name: 'Bob', hero: 'Sonya', heroId: 'Barbarian', team: 0, won: true, kind: 'player' },
    { slot: 5, toonHandle: '2-Hero-1-5', name: 'Eve', hero: 'Raynor', heroId: 'Raynor', team: 1, won: false, kind: 'player' },
  ],
  recorderToonHandle: ID,
  outdated: false,
});

const row = (replayId: string, hero: string, won: boolean) =>
  ({ replayId, slot: 0, kind: 'player', team: 0, name: 'Ann', hero, heroId: hero, role: 'assassin', won }) as unknown as PlayerGameRows['players'][number];

const rows: PlayerGameRows = {
  players: [row('1', 'Jaina', true), row('2', 'Jaina', false), row('3', 'Li-Ming', true)],
  stats: {
    '1': { Takedowns: 10, Deaths: 2, HeroDamage: 40000, Disconnects: 2, TimeDisconnected: 90 } as never,
    '2': { Takedowns: 4, Deaths: 6, HeroDamage: 20000 } as never,
    '3': { Takedowns: 16, Deaths: 1, HeroDamage: 60000 } as never,
  },
  scores: { '3': { awards: ['MVP'], mvp: true } },
};

const ann: PlayerSummary = {
  id: ID,
  name: 'Ann',
  region: 2,
  games: 3,
  wins: 2,
  losses: 1,
  winRate: 2 / 3,
  lastPlayedAt: '2024-03-03T00:00:00.000Z',
  heroes: [],
};

async function open(path: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(PLAYERS_ROUTES, withComponentInputBinding()),
      provideWholeLists(),
      // the shell's own, around every page
      ShellNavStore,
      ShellPanelsStore,
      {
        provide: PlayerService,
        useValue: { players: signal([ann]), loaded: signal(true), error: signal(null) },
      },
      { provide: PlayerGamesService, useValue: { games: () => of(rows) } },
      {
        provide: ReplayService,
        useValue: {
          replays: signal([
            replay('3', 'Sky Temple'),
            replay('2', 'Sky Temple'),
            replay('1', 'Dragon Shire'),
          ]),
          loaded: signal(true),
          error: signal(null),
        },
      },
      {
        provide: LatestHeroData,
        useValue: { lookup: signal(heroLookup(undefined, heroesImages({}))) },
      },
    ],
  });
  const harness = await RouterTestingHarness.create(`/replays/players/${path}`);
  await harness.fixture.whenStable();
  const el = harness.routeNativeElement as HTMLElement;
  return { el: el.closest('hrs-player-page') ?? el.ownerDocument.body, harness };
}

const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();

describe("a player's page and its sections", () => {
  beforeEach(() => localStorage.clear());

  it("opens on the overview: the record, the average match, the heroes and the awards", async () => {
    const { el } = await open(ID);
    expect(text(el.querySelector('.card__name'))).toBe('Ann');
    const figures = Object.fromEntries(
      [...el.querySelectorAll('.figure')].map((f) => [text(f.querySelector('dt')), text(f.querySelector('dd'))]),
    );
    expect(figures).toMatchObject({
      Matches: '3',
      Wins: '2',
      Losses: '1',
      'Win Rate': '66.7%',
      'Time Played': '1h 00m',
      'Average Length': '20:00',
      Takedowns: '10.0',
      Deaths: '3.0',
      'Hero Damage': '40,000',
      Disconnects: '2',
      'Time Disconnected': '1m 30s',
    });
    expect([...el.querySelectorAll('.hero__name')].map(text)).toEqual(['Jaina', 'Li-Ming']);
    expect(text(el.querySelector('.award'))).toBe('MVP×1');
  });

  it('shows a stats section with a row for each hero, and for each map when asked', async () => {
    const { el, harness } = await open(`${ID}/stats/summary`);
    const heads = () => [...el.querySelectorAll('.stat-table__head')].map(text);
    expect(heads()).toEqual(['Jaina', 'Li-Ming']);
    const toggles = [...el.querySelectorAll<HTMLButtonElement>('mat-button-toggle button')];
    toggles.find((b) => text(b) === 'Map')!.click();
    await harness.fixture.whenStable();
    expect(heads()).toEqual(['Sky Temple', 'Dragon Shire']);
  });

  it("lists the people played with, and the player's record with them", async () => {
    const { el } = await open(`${ID}/players/teammates`);
    expect([...el.querySelectorAll('.peers__name')].map(text)).toEqual(['Bob']);
    expect(text(el.querySelector('.record__wl'))).toBe('2–1');
  });

  it('says so for an id nobody has', async () => {
    TestBed.resetTestingModule();
    const { el } = await open('9-Hero-1-9');
    expect(text(el.querySelector('hrs-empty-state h2'))).toBe('Player not found');
  });
});
