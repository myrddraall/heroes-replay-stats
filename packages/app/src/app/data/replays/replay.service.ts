import { computed, inject, Service } from '@angular/core';
import type {
  GameMode,
  PlayerSummary,
  ReplayRecord,
  ReplayStatus,
  Team,
} from '@myrddraall/heroprotocol-db';
import { REPLAY_DB } from '../import/provide-replay-db';
import { liveQuerySignals } from '../live-query';

/** A player as a replay list shows them; observers are left out. */
export type ReplayPlayer = Omit<PlayerSummary, 'kind'> & { readonly kind: 'player' | 'ai' };

/** The basic facts of one stored replay. */
export interface ReplaySummary {
  readonly id: string;
  readonly map: string;
  readonly mode: GameMode;
  /** ISO-8601, UTC. */
  readonly playedAt: string;
  readonly durationSeconds: number;
  readonly winningTeam: Team | null;
  /** The game build, e.g. 85267. */
  readonly build: number;
  /** `complete` once every background analyser has run; `ready` before that. */
  readonly status: Extract<ReplayStatus, 'ready' | 'complete'>;
  /** Participants in slot order. */
  readonly players: readonly ReplayPlayer[];
  /** The account that recorded the replay, when known. */
  readonly recorderToonHandle: string | null;
}

/** Whether a stored replay can be shown: written, with its ready analysers done. */
function isAvailable(r: ReplayRecord): r is ReplayRecord & { status: 'ready' | 'complete' } {
  return r.status === 'ready' || r.status === 'complete';
}

function toSummary(r: ReplayRecord & { status: 'ready' | 'complete' }): ReplaySummary {
  return {
    id: r.id,
    map: r.map,
    mode: r.mode,
    playedAt: r.playedAt,
    durationSeconds: r.durationSeconds,
    winningTeam: r.winningTeam,
    build: r.version.build,
    status: r.status,
    players: r.players
      .filter((p): p is PlayerSummary & { kind: 'player' | 'ai' } => p.kind !== 'observer')
      .sort((a, b) => a.slot - b.slot),
    // absent on replays imported before the recorder was stored
    recorderToonHandle: r.recorderToonHandle ?? null,
  };
}

/**
 * The replays available in the local database and their basic info. The list is live:
 * it updates as imports finish and replays are deleted, wherever that happens.
 */
@Service()
export class ReplayService {
  private readonly db = inject(REPLAY_DB);
  private readonly live = liveQuerySignals(
    this.db.ready,
    async () =>
      (await this.db.db.replays.orderBy('playedAt').reverse().toArray()).filter(isAvailable),
    [] as (ReplayRecord & { status: 'ready' | 'complete' })[],
  );

  /** Every available replay, most recently played first. */
  readonly replays = computed((): readonly ReplaySummary[] => this.live.value().map(toSummary));
  /** False until the database has answered once. */
  readonly loaded = this.live.loaded;
  /** The last error reading the list, or null. */
  readonly error = this.live.error;
}
