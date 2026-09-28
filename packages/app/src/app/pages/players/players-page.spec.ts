import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ReplayImportJobStore } from '../../data/import/replay-import-job.store';
import { PlayerService, type PlayerSummary } from '../../data/players/player.service';
import { PlayersPage } from './players-page';

const ann: PlayerSummary = {
  id: '2-Hero-1-1',
  name: 'Ann',
  region: 2,
  games: 7,
  wins: 4,
  losses: 3,
  winRate: 4 / 7,
  lastPlayedAt: '2024-03-01T00:00:00.000Z',
  heroes: [
    { hero: 'Jaina', games: 3 },
    { hero: 'Sonya', games: 2 },
    { hero: 'Li-Ming', games: 1 },
    { hero: 'Raynor', games: 1 },
  ],
};

async function render(players: PlayerSummary[]) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: PlayerService,
        useValue: { players: signal(players), loaded: signal(true), error: signal(null) },
      },
      { provide: ReplayImportJobStore, useValue: { import: async () => [] } },
    ],
  });
  const fixture = TestBed.createComponent(PlayersPage);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('PlayersPage', () => {
  it('lists each player with region, games, record, last played and top heroes', async () => {
    const el = await render([ann]);
    const text = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim();
    expect(text('.count')).toBe('1 player');
    expect(text('.player__name')).toBe('Ann');
    expect(text('.player__region')).toBe('EU');
    expect(text('[data-label="Games"]')).toBe('7');
    expect(text('.record__wl')).toBe('4–3');
    expect(text('.record__rate')).toBe('57%');
    expect(el.querySelector('time')?.getAttribute('datetime')).toBe(ann.lastPlayedAt);
    expect(
      [...el.querySelectorAll('.hero')].map((h) => h.textContent!.replace(/\s+/g, ' ').trim()),
    ).toEqual(['Jaina ×3', 'Sonya ×2', 'Li-Ming', '+1 more']);
  });

  it('shows the empty state without players', async () => {
    const el = await render([]);
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('hrs-empty-state h2')?.textContent).toBe('Nobody here yet');
  });
});
