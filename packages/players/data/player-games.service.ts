import { inject, Service } from '@angular/core';
import type { PlayerStatsRow, ScoreScreenPlayerRow } from '@myrddraall/heroprotocol-analysis';
import type { PlayerRecord } from '@myrddraall/heroprotocol-db';
import { liveQuery } from 'dexie';
import { from, type Observable, switchMap } from 'rxjs';
import { REPLAY_DB } from '@myrddraall/heroes-replay-stats-import/data';
import type { PlayerGameRows } from '../model';

/** The prefix of a player id that is a name, not an account (see `playerId`). */
const NAME_ID = 'name:';

const byReplay = <T extends { readonly replayId: string }>(
  rows: readonly (T | undefined)[],
): Record<string, T> =>
  Object.fromEntries(rows.filter((r) => r !== undefined).map((r) => [r.replayId, r]));

/**
 * One player's rows across the stored replays: who they were in each match, and that match's stats
 * and score screen rows of theirs. Live: it updates as replays are imported, analysed again and
 * deleted, and ends with the subscription.
 */
@Service()
export class PlayerGamesService {
  private readonly db = inject(REPLAY_DB);

  /** The rows of the player with this id: an account's handle, or `name:<name>` for one without. */
  games(playerId: string): Observable<PlayerGameRows> {
    return from(this.db.ready).pipe(
      switchMap(() =>
        from(
          liveQuery(async (): Promise<PlayerGameRows> => {
            const { db } = this.db;
            const all = playerId.startsWith(NAME_ID)
              ? await db.players
                  .filter((p) => p.toon === null && p.name === playerId.slice(NAME_ID.length))
                  .toArray()
              : await db.players.where('toon.handle').equals(playerId).toArray();
            const players = all.filter((p: PlayerRecord) => p.kind === 'player');
            const keys = players.map((p) => [p.replayId, p.slot]);
            const [stats, scores] = await Promise.all([
              db.table<PlayerStatsRow & { replayId: string }>('playerStats').bulkGet(keys),
              db.table<ScoreScreenPlayerRow & { replayId: string }>('scoreScreenPlayers').bulkGet(keys),
            ]);
            return { players, stats: byReplay(stats), scores: byReplay(scores) };
          }),
        ),
      ),
    );
  }
}
