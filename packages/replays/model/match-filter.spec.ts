import { describe, expect, it } from 'vitest';
import {
  ANY_MATCH,
  filterMatches,
  isFiltering,
  matchOptions,
  playedDay,
  type FilteredMatch,
} from './match-filter';

const player = (slot: number, hero: string, name: string) =>
  ({ slot, hero, name, heroId: hero, toonHandle: null, team: 0, won: null, kind: 'player' }) as const;

const match = (
  map: string,
  mode: FilteredMatch['replay']['mode'],
  playedAt: string,
  heroes: readonly [string, string][],
  yours: number[] = [0],
): FilteredMatch => ({
  replay: { map, mode, playedAt, players: heroes.map(([hero, name], slot) => player(slot, hero, name)) },
  you: { slots: yours, team: 0 },
});

const now = new Date(2026, 10, 4, 15, 0); // Nov 4, 2026, 15:00 local
const at = (days: number, hour = 12) => new Date(2026, 10, 4 - days, hour).toISOString();

const cursed = match('Cursed Hollow', 'quick-match', at(0), [['Tracer', 'Erd'], ['Li-Ming', 'essn']]);
const sky = match('Sky Temple', 'storm-league', at(3), [['Genji', 'Erd'], ['Tracer', 'Dmonkey']]);
const old = match('Cursed Hollow', 'storm-league', at(20), [['Tracer', 'Erd'], ['Abathur', 'Dunes']]);
const all = [cursed, sky, old];

describe('filterMatches', () => {
  it('passes every match through when nothing is chosen', () => {
    expect(isFiltering(ANY_MATCH)).toBe(false);
    expect(filterMatches(all, ANY_MATCH, now)).toBe(all);
  });

  it('keeps the matches on a map, in a mode, or where you played a hero', () => {
    expect(filterMatches(all, { ...ANY_MATCH, map: 'Cursed Hollow' }, now)).toEqual([cursed, old]);
    expect(filterMatches(all, { ...ANY_MATCH, mode: 'storm-league' }, now)).toEqual([sky, old]);
    // Tracer was played in Sky Temple too, but not by you
    expect(filterMatches(all, { ...ANY_MATCH, hero: 'Tracer' }, now)).toEqual([cursed, old]);
  });

  it('keeps the matches played today, in the last 7 days or the last 30', () => {
    expect(filterMatches(all, { ...ANY_MATCH, played: 'today' }, now)).toEqual([cursed]);
    expect(filterMatches(all, { ...ANY_MATCH, played: 'week' }, now)).toEqual([cursed, sky]);
    expect(filterMatches(all, { ...ANY_MATCH, played: 'month' }, now)).toEqual(all);
    // the first of the 7 days counts from its start
    const sixDays = match('Braxis Holdout', 'quick-match', at(6, 0), [['Valla', 'Erd']]);
    expect(filterMatches([sixDays], { ...ANY_MATCH, played: 'week' }, now)).toEqual([sixDays]);
  });

  it('searches maps, heroes and names, every word, any case', () => {
    expect(filterMatches(all, { ...ANY_MATCH, text: 'dunes' }, now)).toEqual([old]);
    expect(filterMatches(all, { ...ANY_MATCH, text: 'tracer hollow' }, now)).toEqual([cursed, old]);
    expect(filterMatches(all, { ...ANY_MATCH, text: '  sky   GENJI ' }, now)).toEqual([sky]);
  });

  it('combines the choices', () => {
    expect(filterMatches(all, { ...ANY_MATCH, map: 'Cursed Hollow', played: 'week' }, now)).toEqual([
      cursed,
    ]);
  });
});

describe('matchOptions', () => {
  it('lists the maps, modes and your heroes that occur, sorted', () => {
    expect(matchOptions(all)).toEqual({
      maps: ['Cursed Hollow', 'Sky Temple'],
      modes: ['quick-match', 'storm-league'],
      heroes: ['Genji', 'Tracer'],
    });
  });
});

describe('playedDay', () => {
  it('is the local day a match was played on', () => {
    expect(playedDay(new Date(2026, 10, 4, 23, 59).toISOString())).toBe('2026-11-04');
    expect(playedDay(new Date(2026, 0, 2, 0, 1).toISOString())).toBe('2026-01-02');
  });
});
