import type { PlayerStatsRow, ScoreScreenPlayerRow } from '@myrddraall/heroprotocol-analysis';
import type { PlayerRecord, Team } from '@myrddraall/heroprotocol-db';
import type { ReplaySummary, You } from '@myrddraall/heroes-replay-stats-replays/model';

/** A player's own rows in the stored replays: who they were in each, and that game's stats. */
export interface PlayerGameRows {
  /** Their row in each replay they are in. */
  readonly players: readonly PlayerRecord[];
  /** Their stats row in each of those replays, by `replayId`; none for one not analysed yet. */
  readonly stats: Readonly<Record<string, PlayerStatsRow>>;
  /** Their score screen row (the awards) in each, by `replayId`. */
  readonly scores: Readonly<Record<string, Pick<ScoreScreenPlayerRow, 'awards' | 'mvp'>>>;
}

/** No rows: nothing read yet, or nobody by that id. */
export const NO_PLAYER_GAMES: PlayerGameRows = { players: [], stats: {}, scores: {} };

/** One match a player played: the match, who they were in it and how it went for them. */
export interface PlayerGame {
  readonly replay: ReplaySummary;
  /** The player in it, as the match filter and the match cards see "you". */
  readonly you: You;
  readonly slot: number;
  readonly name: string;
  readonly hero: string;
  readonly heroId: string;
  /** The hero's role as the replay records it (`warrior`); null where it records none. */
  readonly role: string | null;
  readonly team: Team | null;
  readonly won: boolean | null;
  /** Their stats that game, by stat id; null until the replay's stats have been worked out. */
  readonly stats: Readonly<Record<string, unknown>> | null;
  /** The awards the score screen gave them, MVP not among them. */
  readonly awards: readonly string[];
  readonly mvp: boolean;
}

/**
 * A player's matches, most recently played first: their rows joined with the replays that can be
 * opened (one still importing, or deleted since, is left out).
 */
export function playerGames(
  rows: PlayerGameRows,
  replays: readonly ReplaySummary[],
): PlayerGame[] {
  const byId = new Map(replays.map((r) => [r.id, r]));
  const games: PlayerGame[] = [];
  for (const p of rows.players) {
    const replay = byId.get(p.replayId);
    if (!replay || p.kind !== 'player') continue;
    const score = rows.scores[p.replayId];
    games.push({
      replay,
      you: { slots: [p.slot], team: p.team },
      slot: p.slot,
      name: p.name,
      hero: p.hero,
      heroId: p.heroId,
      role: p.role,
      team: p.team,
      won: p.won,
      stats: rows.stats[p.replayId] ?? null,
      awards: (score?.awards ?? []).filter((a) => a !== 'MVP'),
      mvp: score?.mvp ?? false,
    });
  }
  return games.sort((a, b) => b.replay.playedAt.localeCompare(a.replay.playedAt));
}
