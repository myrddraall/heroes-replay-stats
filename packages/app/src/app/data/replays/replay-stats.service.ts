import { inject, Service } from '@angular/core';
import type {
  ChatLineRow,
  PlayerStatsRow,
  PlayerStatsSupportRow,
  ScoreScreenPlayerRow,
  ScoreScreenTeamRow,
} from '@myrddraall/heroprotocol-analysis';
import type { StatSupportTable } from '@myrddraall/heroprotocol-db';
import { liveQuery } from 'dexie';
import { from, type Observable, switchMap } from 'rxjs';
import { REPLAY_DB } from '../import/provide-replay-db';

/** A replay's score screen: each player's line and each team's totals. */
export interface ReplayScoreScreen {
  /** In slot order. */
  readonly players: readonly ScoreScreenPlayerRow[];
  readonly teams: readonly ScoreScreenTeamRow[];
}

/** A replay's full player stats and what its build can tell about each stat. */
export interface ReplayPlayerStats {
  /** In slot order. */
  readonly players: readonly PlayerStatsRow[];
  readonly support: StatSupportTable;
}

const bySlot = (a: { slot: number }, b: { slot: number }): number => a.slot - b.slot;

/** The analyser that writes `chatLines`; it runs in the background after an import. */
const CHAT_ANALYSER = '@myrddraall/chat';

/**
 * One replay's tables, as the `score-screen`, `player-stats` and `chat` analysers stored them.
 * Each is live: it updates when the replay is analysed again, and ends with the subscription.
 */
@Service()
export class ReplayStatsService {
  private readonly db = inject(REPLAY_DB);

  scoreScreen(replayId: string): Observable<ReplayScoreScreen> {
    return this.live(async () => {
      const [players, teams] = await Promise.all([
        this.rows<ScoreScreenPlayerRow>('scoreScreenPlayers', replayId),
        this.rows<ScoreScreenTeamRow>('scoreScreenTeams', replayId),
      ]);
      return { players: players.sort(bySlot), teams };
    });
  }

  playerStats(replayId: string): Observable<ReplayPlayerStats> {
    return this.live(async () => {
      const [players, [support]] = await Promise.all([
        this.rows<PlayerStatsRow>('playerStats', replayId),
        this.rows<PlayerStatsSupportRow>('playerStatsSupport', replayId),
      ]);
      return { players: players.sort(bySlot), support: support?.statSupport ?? {} };
    });
  }

  /**
   * A replay's chat (both teams', as typed) and the recording player's team's pings, in game
   * order. The chat analyser runs in the background after an import, so it is asked for first:
   * it runs now if it hasn't yet, and answers from its stored run if it has.
   */
  chat(replayId: string): Observable<readonly ChatLineRow[]> {
    return from(this.db.ready).pipe(
      switchMap(() => this.db.analyse(replayId, CHAT_ANALYSER)),
      switchMap(() =>
        from(
          liveQuery(async () =>
            (await this.rows<ChatLineRow>('chatLines', replayId)).sort((a, b) => a.seq - b.seq),
          ),
        ),
      ),
    );
  }

  private rows<T>(table: string, replayId: string): Promise<T[]> {
    return this.db.db.table<T>(table).where('replayId').equals(replayId).toArray();
  }

  private live<T>(query: () => Promise<T>): Observable<T> {
    return from(this.db.ready).pipe(switchMap(() => from(liveQuery(query))));
  }
}
