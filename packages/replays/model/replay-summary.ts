import type { GameMode, PlayerSummary, ReplayStatus, Team } from '@myrddraall/heroprotocol-db';

/** A player as a replay list shows them; observers are left out. */
export type ReplayPlayer = Omit<PlayerSummary, 'kind'> & { readonly kind: 'player' | 'ai' };

/** The basic facts of one stored replay. */
export interface ReplaySummary {
  readonly id: string;
  readonly map: string;
  readonly mode: GameMode;
  /** ISO-8601, UTC. */
  readonly playedAt: string;
  /** ISO-8601, when the replay was imported. */
  readonly importedAt: string;
  readonly durationSeconds: number;
  readonly winningTeam: Team | null;
  /** The game build, e.g. 85267. */
  readonly build: number;
  /**
   * `ingesting` while its rows are written and `analysing` while its first analysers run (it
   * can't be opened yet); then `ready`, and `complete` once every background analyser has run.
   */
  readonly status: Exclude<ReplayStatus, 'failed'>;
  /** Participants in slot order. */
  readonly players: readonly ReplayPlayer[];
  /** The account that recorded the replay, when known. */
  readonly recorderToonHandle: string | null;
  /**
   * An earlier version of the importer stored it: some details may be out of date until its
   * file is imported again.
   */
  readonly outdated: boolean;
}
