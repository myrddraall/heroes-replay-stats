import { computed, inject, Service } from '@angular/core';
import {
  NORMALIZE_VERSION,
  type PlayerSummary,
  type ReplayRecord,
} from '@myrddraall/heroprotocol-db';
import { liveQuerySignals, REPLAY_DB } from '@myrddraall/heroes-replay-stats-import/data';
import type { ReplaySummary } from '../model';

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
    importedAt: r.ingestedAt,
    durationSeconds: r.durationSeconds,
    winningTeam: r.winningTeam,
    build: r.version.build,
    status: r.status,
    players: r.players
      .filter((p): p is PlayerSummary & { kind: 'player' | 'ai' } => p.kind !== 'observer')
      .sort((a, b) => a.slot - b.slot),
    // absent on replays imported before the recorder was stored
    recorderToonHandle: r.recorderToonHandle ?? null,
    outdated: r.normalizeVersion !== NORMALIZE_VERSION,
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
  /**
   * How many of them an earlier version of the importer stored: their details may be out of
   * date, and importing their files again brings them up to date.
   */
  readonly outdated = computed(() => this.replays().filter((r) => r.outdated).length);
  /** False until the database has answered once. */
  readonly loaded = this.live.loaded;
  /** The last error reading the list, or null. */
  readonly error = this.live.error;
}
