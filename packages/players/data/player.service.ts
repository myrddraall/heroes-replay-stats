import { computed, inject, Service } from '@angular/core';
import { liveQuerySignals, REPLAY_DB } from '@myrddraall/heroes-replay-stats-import/data';
import { type PlayerRows, type PlayerSummary, summarisePlayers } from '../model';

/**
 * The people in the stored replays and their basic numbers: games, wins, losses, when
 * they last played and which heroes. Live, like the replay list. AI and observers are
 * not players here; replays still being imported do not count yet.
 */
@Service()
export class PlayerService {
  private readonly db = inject(REPLAY_DB);
  private readonly live = liveQuerySignals<PlayerRows>(
    this.db.ready,
    async () => {
      const [replays, players] = await Promise.all([
        this.db.db.replays.toArray(),
        this.db.db.players.toArray(),
      ]);
      return { replays, players };
    },
    { replays: [], players: [] },
  );

  /** Every player, most games first, then most recently played. */
  readonly players = computed((): readonly PlayerSummary[] => summarisePlayers(this.live.value()));
  /** False until the database has answered once. */
  readonly loaded = this.live.loaded;
  /** The last error reading the players, or null. */
  readonly error = this.live.error;
}
