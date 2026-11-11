import { describe, expect, it } from 'vitest';
import type { HeroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import type { ReplaySummary } from '@myrddraall/heroes-replay-stats-replays/model';
import type { PlayerGame } from '../../model';
import { playerColumns } from '../player-columns';
import { playerBreakdown } from './player-breakdown.presenter';

const heroes = { heroPortrait: () => null } as unknown as HeroLookup;

const game = (hero: string, mode: string, stats: Record<string, number>): PlayerGame =>
  ({
    replay: { id: hero, map: 'Sky Temple', mode, durationSeconds: 900 } as unknown as ReplaySummary,
    hero,
    heroId: hero,
    role: null,
    won: true,
    stats,
  }) as PlayerGame;

const games = [
  game('Jaina', 'quick-match', { Deaths: 2, HeroDamage: 40000, KDARatio: 3 }),
  game('Jaina', 'aram', { Deaths: 5, HeroDamage: 60000, KDARatio: 1 }),
  game('Sonya', 'aram', { Deaths: 1, HeroDamage: 20000, KDARatio: 8 }),
];
const columns = playerColumns(['games', 'winRate', 'KDARatio', 'Deaths', 'HeroDamage']);

describe('playerBreakdown', () => {
  it('has a row for each hero with its average match, counts with a decimal', () => {
    const { rows, columns: shown } = playerBreakdown(games, 'hero', columns, 'average', heroes);
    expect(rows.map((r) => [r.key, r.data.hero, r.values])).toEqual([
      ['Jaina', true, { games: 2, winRate: 1, KDARatio: 2, Deaths: 3.5, HeroDamage: 50000 }],
      ['Sonya', true, { games: 1, winRate: 1, KDARatio: 8, Deaths: 1, HeroDamage: 20000 }],
    ]);
    const format = (id: string) => shown.find((c) => c.id === id)?.format;
    expect(format('games')).toBe('integer');
    expect(format('Deaths')).toBe('decimal');
    expect(format('HeroDamage')).toBe('integer');
  });

  it('leaves out of the totals what a sum means nothing for', () => {
    const { rows, columns: shown } = playerBreakdown(games, 'mode', columns, 'total', heroes);
    expect(shown.map((c) => c.id)).toEqual(['games', 'winRate', 'Deaths', 'HeroDamage']);
    expect(rows.map((r) => [r.data.label, r.data.hero, r.values['Deaths']])).toEqual([
      ['ARAM', false, 6],
      ['Quick Match', false, 2],
    ]);
  });
});
