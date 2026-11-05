import type { GameMode } from '@myrddraall/heroprotocol-db';
import type { You } from '@myrddraall/heroes-replay-stats-players/model';
import type { ReplaySummary } from './replay-summary';

/** How recently a match was played, for the filter: any time, today, the last 7 or 30 days. */
export type PlayedWithin = 'any' | 'today' | 'week' | 'month';

export const PLAYED_WITHIN: readonly PlayedWithin[] = ['any', 'today', 'week', 'month'];

/** Which matches the list shows. An empty map, mode or hero is any. */
export interface MatchFilter {
  /** Words every one of which a match's map, a hero or a player's name contains (any case). */
  readonly text: string;
  readonly map: string;
  readonly mode: GameMode | '';
  /** A hero you played. */
  readonly hero: string;
  readonly played: PlayedWithin;
}

export const ANY_MATCH: MatchFilter = { text: '', map: '', mode: '', hero: '', played: 'any' };

/** A match as the filter sees it: the replay and who you were in it. */
export interface FilteredMatch {
  readonly replay: Pick<ReplaySummary, 'map' | 'mode' | 'playedAt' | 'players'>;
  readonly you: You;
}

/** Whether a filter narrows the list at all. */
export function isFiltering(filter: MatchFilter): boolean {
  return (
    filter.text.trim() !== '' ||
    filter.map !== '' ||
    filter.mode !== '' ||
    filter.hero !== '' ||
    filter.played !== 'any'
  );
}

/** The start of the day `now` is in, local time, moved back `days` days. */
function dayStart(now: Date, days = 0): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days).getTime();
}

/** The earliest time a match may have been played at to pass `played`, as of `now`. */
function playedSince(played: PlayedWithin, now: Date): number {
  switch (played) {
    case 'today':
      return dayStart(now);
    case 'week':
      return dayStart(now, 6);
    case 'month':
      return dayStart(now, 29);
    case 'any':
      return -Infinity;
  }
}

/** The matches that pass a filter, in their order, as of `now` (for the played-within choices). */
export function filterMatches<T extends FilteredMatch>(
  matches: readonly T[],
  filter: MatchFilter,
  now: Date,
): readonly T[] {
  if (!isFiltering(filter)) return matches;
  const words = filter.text.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const since = playedSince(filter.played, now);
  return matches.filter(({ replay, you }) => {
    if (filter.map && replay.map !== filter.map) return false;
    if (filter.mode && replay.mode !== filter.mode) return false;
    if (filter.hero && !yourHeroes(replay, you).includes(filter.hero)) return false;
    if (since > -Infinity && Date.parse(replay.playedAt) < since) return false;
    if (words.length) {
      const text = [replay.map, ...replay.players.flatMap((p) => [p.hero, p.name])]
        .join('\n')
        .toLocaleLowerCase();
      if (!words.every((w) => text.includes(w))) return false;
    }
    return true;
  });
}

/** The heroes you played in a match (more than one only when several of your accounts played). */
function yourHeroes(replay: FilteredMatch['replay'], you: You): string[] {
  return replay.players.filter((p) => you.slots.includes(p.slot)).map((p) => p.hero);
}

/** What the filter can choose from: the maps, modes and your heroes that occur in the matches, sorted. */
export interface MatchOptions {
  readonly maps: readonly string[];
  readonly modes: readonly GameMode[];
  readonly heroes: readonly string[];
}

export function matchOptions(matches: readonly FilteredMatch[]): MatchOptions {
  const maps = new Set<string>();
  const modes = new Set<GameMode>();
  const heroes = new Set<string>();
  for (const { replay, you } of matches) {
    maps.add(replay.map);
    modes.add(replay.mode);
    for (const hero of yourHeroes(replay, you)) heroes.add(hero);
  }
  const sorted = <S extends string>(values: Set<S>) => [...values].sort((a, b) => a.localeCompare(b));
  return { maps: sorted(maps), modes: sorted(modes), heroes: sorted(heroes) };
}

/** The local day a match was played on (`2026-11-04`): the key its day's group goes by. */
export function playedDay(playedAt: string): string {
  const at = new Date(playedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}
