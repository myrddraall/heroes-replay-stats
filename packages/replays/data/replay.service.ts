import { computed, inject, Service } from '@angular/core';
import {
  NORMALIZE_VERSION,
  type PlayerSummary,
  type ReplayRecord,
} from '@myrddraall/heroprotocol-db';
import { liveQuerySignals, REPLAY_DB } from '@myrddraall/heroes-replay-stats-import/data';
import type { ReplaySummary } from '../model';

type ListedRecord = ReplayRecord & { status: ReplaySummary['status'] };

/** Whether a stored replay is listed at all: any that hasn't failed, importing ones included. */
function isListed(r: ReplayRecord): r is ListedRecord {
  return r.status !== 'failed';
}

/** Whether a replay can be opened: written, with its ready analysers done. */
function isAvailable(r: ReplaySummary): boolean {
  return r.status === 'ready' || r.status === 'complete';
}

function toSummary(r: ListedRecord): ReplaySummary {
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
 * The replays in the local database and their basic info. The list is live: it updates as
 * imports write and finish and replays are deleted, wherever that happens.
 */
@Service()
export class ReplayService {
  private readonly db = inject(REPLAY_DB);
  private readonly live = liveQuerySignals(
    this.db.ready,
    async () =>
      (await this.db.db.replays.orderBy('playedAt').reverse().toArray()).filter(isListed),
    [] as ListedRecord[],
  );

  /**
   * Every stored replay, most recently played first, importing ones included (an import that
   * stopped part-way, as when its tab closed, also stays `ingesting` or `analysing`).
   */
  readonly listed = computed((): readonly ReplaySummary[] => this.live.value().map(toSummary));
  /** Every replay that can be opened, most recently played first. */
  readonly replays = computed(() => this.listed().filter(isAvailable));
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
