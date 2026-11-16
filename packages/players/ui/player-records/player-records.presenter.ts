import type { HeroIcon, HeroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import type { StatColumn } from '@myrddraall/heroes-replay-stats-replays/model';
import { MODE_LABELS } from '@myrddraall/heroes-replay-stats-replays/ui';
import { playerRecords, type PlayerGame } from '../../model';

/** One of a player's records as the table shows it: the stat, its highest figure and the match it was in. */
export interface PlayerRecordRow {
  readonly column: StatColumn;
  readonly value: number;
  readonly replayId: string;
  readonly hero: string;
  readonly icon: HeroIcon | null;
  readonly map: string;
  readonly mode: string;
  /** ISO-8601, UTC. */
  readonly playedAt: string;
  readonly won: boolean | null;
}

/** A player's records over some matches, for these stats, in the stats' order. */
export function toPlayerRecordRows(
  games: readonly PlayerGame[],
  columns: readonly StatColumn[],
  heroes: HeroLookup,
): PlayerRecordRow[] {
  return playerRecords(games, columns).map(({ column, value, game }) => ({
    column,
    value,
    replayId: game.replay.id,
    hero: game.hero,
    icon: heroes.heroIcon(game.heroId, game.hero),
    map: game.replay.map,
    mode: MODE_LABELS[game.replay.mode],
    playedAt: game.replay.playedAt,
    won: game.won,
  }));
}
