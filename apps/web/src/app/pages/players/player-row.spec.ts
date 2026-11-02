import { describe, expect, it } from 'vitest';
import type { PlayerSummary } from '../../data/players/player.service';
import { toPlayerRow } from './player-row';

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

describe('toPlayerRow', () => {
  it('names the region, the top three heroes and how many more', () => {
    const row = toPlayerRow(ann, new Set());
    expect(row.region).toBe('EU');
    expect(row.topHeroes.map((h) => h.hero)).toEqual(['Jaina', 'Sonya', 'Li-Ming']);
    expect(row.moreHeroes).toBe(1);
    expect(toPlayerRow({ ...ann, region: null }, new Set()).region).toBeNull();
    expect(toPlayerRow({ ...ann, region: 9 }, new Set()).region).toBeNull();
  });

  it('lets only accounts with a toon handle be me, and knows which are', () => {
    expect(toPlayerRow(ann, new Set()).canBeMe).toBe(true);
    expect(toPlayerRow(ann, new Set()).isMe).toBe(false);
    expect(toPlayerRow(ann, new Set(['2-Hero-1-1'])).isMe).toBe(true);
    expect(toPlayerRow({ ...ann, id: 'name:Bot' }, new Set()).canBeMe).toBe(false);
  });
});
