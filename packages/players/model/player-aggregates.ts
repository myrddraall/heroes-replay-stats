import type { GameMode } from '@myrddraall/heroprotocol-db';
import type { StatColumn } from '@myrddraall/heroes-replay-stats-replays/model';
import type { PlayerGame } from './player-game';
import { playerId } from './player-summary';

/** How a stat's figures over several matches become one: their mean, their sum, or the best of them. */
export type Aggregate = 'average' | 'total' | 'best';

export const AGGREGATES: readonly Aggregate[] = ['average', 'total', 'best'];

/** What a player's matches are split by: the hero played, its role, the map or the game mode. */
export type GroupBy = 'hero' | 'role' | 'map' | 'mode';

export const GROUP_BYS: readonly GroupBy[] = ['hero', 'role', 'map', 'mode'];

/**
 * The figures about the matches themselves, the same whatever the {@link Aggregate}: how many, how
 * many won and lost, and the share won.
 */
export const RECORD_STAT_IDS = ['games', 'wins', 'losses', 'winRate'] as const;

/** A match's length, in seconds: a stat of the match, not of the player's stats row. */
export const LENGTH_STAT_ID = 'length';

/** Integer stats that are not counts of the game: a sum of them over matches says nothing. */
const NEVER_SUMMED: ReadonlySet<string> = new Set(['HighestKillStreak', 'TeamLevel', 'Level']);

/** Whether a stat's sum over matches means something: counts and lengths of time (the matches' own among them), not rates or per-life figures. */
export function isSummed(column: Pick<StatColumn, 'id' | 'format'>): boolean {
  if (column.id === LENGTH_STAT_ID) return true;
  return (
    (column.format === 'integer' || column.format === 'duration') &&
    !column.id.startsWith('Average') &&
    !NEVER_SUMMED.has(column.id)
  );
}

/** A stat's figure in one match; null where the match has none. */
export function gameStat(game: PlayerGame, id: string): number | null {
  if (id === LENGTH_STAT_ID) return game.replay.durationSeconds;
  const value = game.stats?.[id];
  return typeof value === 'number' && !Number.isNaN(value) ? value : null;
}

/** How many of the matches were won, lost, and the share won of those with a result (null without any). */
export function winLoss(games: readonly PlayerGame[]): {
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number | null;
} {
  let wins = 0;
  let losses = 0;
  for (const g of games) {
    if (g.won === true) wins++;
    else if (g.won === false) losses++;
  }
  return { wins, losses, winRate: wins + losses === 0 ? null : wins / (wins + losses) };
}

/**
 * One stat over some matches: the mean, the sum or the best (the lowest where lower is better) of
 * the matches that have it; null when none has, and for the sum of a stat that isn't summed.
 */
export function aggregateStat(
  games: readonly PlayerGame[],
  column: Pick<StatColumn, 'id' | 'format' | 'better'>,
  how: Aggregate,
): number | null {
  if (how === 'total' && !isSummed(column)) return null;
  let sum = 0;
  let count = 0;
  let best: number | null = null;
  for (const game of games) {
    const value = gameStat(game, column.id);
    if (value === null) continue;
    sum += value;
    count++;
    if (best === null || (column.better === 'lower' ? value < best : value > best)) best = value;
  }
  if (count === 0) return null;
  return how === 'average' ? sum / count : how === 'total' ? sum : best;
}

/** The columns' figures over some matches, by column id: the record's as they are, the rest aggregated. */
export function aggregateStats(
  games: readonly PlayerGame[],
  columns: readonly StatColumn[],
  how: Aggregate,
): Readonly<Record<string, number | null>> {
  const record: Readonly<Record<string, number | null>> = { games: games.length, ...winLoss(games) };
  return Object.fromEntries(
    columns.map((c) => [c.id, c.id in record ? record[c.id]! : aggregateStat(games, c, how)]),
  );
}

/** Some of a player's matches that share something (a hero, a map). */
export interface GameGroup {
  /** What they share: the hero's or map's name, the role, the mode. */
  readonly key: string;
  readonly games: readonly PlayerGame[];
}

/** The role's key for a match whose replay records none. */
export const NO_ROLE = 'unknown';

function groupKey(game: PlayerGame, by: GroupBy): string {
  switch (by) {
    case 'hero':
      return game.hero;
    case 'role':
      return game.role ?? NO_ROLE;
    case 'map':
      return game.replay.map;
    case 'mode':
      return game.replay.mode satisfies GameMode;
  }
}

/** The matches split by hero, role, map or mode: the largest group first, ties by key. */
export function groupGames(games: readonly PlayerGame[], by: GroupBy): GameGroup[] {
  const groups = new Map<string, PlayerGame[]>();
  for (const game of games) {
    const key = groupKey(game, by);
    const group = groups.get(key);
    if (group) group.push(game);
    else groups.set(key, [game]);
  }
  return [...groups]
    .map(([key, g]) => ({ key, games: g }))
    .sort((a, b) => b.games.length - a.games.length || a.key.localeCompare(b.key));
}

/** A player's highest figure for one stat, and the match it was in. */
export interface PlayerRecordGame {
  readonly column: StatColumn;
  readonly value: number;
  readonly game: PlayerGame;
}

/**
 * The player's highest figure for each of the stats and its match (the most recent of equals);
 * stats no match has, or whose highest is zero, are left out.
 */
export function playerRecords(
  games: readonly PlayerGame[],
  columns: readonly StatColumn[],
): PlayerRecordGame[] {
  const records: PlayerRecordGame[] = [];
  for (const column of columns) {
    let top: { value: number; game: PlayerGame } | null = null;
    // most recent first, so the first of equals stays
    for (const game of games) {
      const value = gameStat(game, column.id);
      if (value !== null && (top === null || value > top.value)) top = { value, game };
    }
    if (top && top.value > 0) records.push({ column, ...top });
  }
  return records;
}

/** Someone a player shared matches with, on their team or the other, and how those went for the player. */
export interface PlayerPeer {
  /** As {@link playerId}. */
  readonly id: string;
  /** The name from the most recent of those matches. */
  readonly name: string;
  readonly games: number;
  /** The player's own wins and losses in those matches. */
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number | null;
  /** ISO-8601, UTC. */
  readonly lastPlayedAt: string;
}

/**
 * The people in the player's matches: those on their team (`with`) and those on the other
 * (`against`), each most matches first, then most recent. AI and observers are nobody.
 */
export function playerPeers(games: readonly PlayerGame[]): {
  readonly with: readonly PlayerPeer[];
  readonly against: readonly PlayerPeer[];
} {
  interface Entry {
    name: string;
    games: PlayerGame[];
    lastPlayedAt: string;
  }
  const sides = { with: new Map<string, Entry>(), against: new Map<string, Entry>() };
  for (const game of games) {
    if (game.team === null) continue;
    for (const other of game.replay.players) {
      if (other.kind !== 'player' || other.slot === game.slot || other.team === null) continue;
      const side = other.team === game.team ? sides.with : sides.against;
      const id = playerId({ toon: other.toonHandle ? { handle: other.toonHandle } : null, name: other.name });
      const entry = side.get(id);
      // most recent first: the first match names them
      if (entry) entry.games.push(game);
      else side.set(id, { name: other.name, games: [game], lastPlayedAt: game.replay.playedAt });
    }
  }
  const peers = (side: Map<string, Entry>): PlayerPeer[] =>
    [...side]
      .map(([id, e]) => ({
        id,
        name: e.name,
        games: e.games.length,
        ...winLoss(e.games),
        lastPlayedAt: e.lastPlayedAt,
      }))
      .sort(
        (a, b) =>
          b.games - a.games ||
          b.lastPlayedAt.localeCompare(a.lastPlayedAt) ||
          a.name.localeCompare(b.name),
      );
  return { with: peers(sides.with), against: peers(sides.against) };
}

/** How often the player got each award, most often first, ties by id; MVP is counted apart. */
export function awardCounts(
  games: readonly PlayerGame[],
): { readonly award: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const game of games)
    for (const award of game.awards) counts.set(award, (counts.get(award) ?? 0) + 1);
  return [...counts]
    .map(([award, count]) => ({ award, count }))
    .sort((a, b) => b.count - a.count || a.award.localeCompare(b.award));
}
