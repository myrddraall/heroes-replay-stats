import type {
  DraftRow,
  DraftStepRow,
  PlayerKillsRow,
  PlayerStatsRow,
  ScoreScreenPlayerRow,
  ScoreScreenTeamRow,
  TeamKillsRow,
} from '@myrddraall/heroprotocol-analysis';
import type { StatSupportTable } from '@myrddraall/heroprotocol-db';

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

/** A replay's draft: how heroes were picked, and its bans and picks in order. */
export interface ReplayDraft {
  /** Null when the replay has no draft row. */
  readonly draft: DraftRow | null;
  /** In order. */
  readonly steps: readonly DraftStepRow[];
}

/** The units each player and each team killed. */
export interface ReplayUnitKills {
  /** In slot order. */
  readonly players: readonly PlayerKillsRow[];
  /** In team order. */
  readonly teams: readonly TeamKillsRow[];
}
