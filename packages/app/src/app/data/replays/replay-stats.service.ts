import { inject, Service } from '@angular/core';
import type {
  ActivityRow,
  ChatLineRow,
  DraftRow,
  DraftStepRow,
  PlayerKillsRow,
  PlayerStatsRow,
  PlayerStatsSupportRow,
  ScoreScreenPlayerRow,
  ScoreScreenTeamRow,
  TalentPickRow,
  TeamKillsRow,
  TeamStatsRow,
  XpPointRow,
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

const bySlot = (a: { slot: number }, b: { slot: number }): number => a.slot - b.slot;

/** Analysers that run in the background after an import, by the tables they write. */
const CHAT_ANALYSER = '@myrddraall/chat';
const TALENTS_ANALYSER = '@myrddraall/talents';
const XP_CURVE_ANALYSER = '@myrddraall/xp-curve';
/** Runs when first asked for, after the commands analyser. */
const ACTIVITY_ANALYSER = '@myrddraall/activity';

/**
 * One replay's tables, as the built-in analysers stored them. Each is live: it updates when the
 * replay is analysed again, and ends with the subscription.
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
    return this.analysed(replayId, CHAT_ANALYSER, async () =>
      (await this.rows<ChatLineRow>('chatLines', replayId)).sort((a, b) => a.seq - b.seq),
    );
  }

  draft(replayId: string): Observable<ReplayDraft> {
    return this.live(async () => {
      const [[draft], steps] = await Promise.all([
        this.rows<DraftRow>('draft', replayId),
        this.rows<DraftStepRow>('draftSteps', replayId),
      ]);
      return { draft: draft ?? null, steps: steps.sort((a, b) => a.order - b.order) };
    });
  }

  /** Each player's talent picks, by slot then tier; the talents analyser runs first if it hasn't. */
  talentPicks(replayId: string): Observable<readonly TalentPickRow[]> {
    return this.analysed(replayId, TALENTS_ANALYSER, async () =>
      (await this.rows<TalentPickRow>('talentPicks', replayId)).sort(
        (a, b) => a.slot - b.slot || a.tier - b.tier,
      ),
    );
  }

  unitKills(replayId: string): Observable<ReplayUnitKills> {
    return this.live(async () => {
      const [players, teams] = await Promise.all([
        this.rows<PlayerKillsRow>('unitKills', replayId),
        this.rows<TeamKillsRow>('teamUnitKills', replayId),
      ]);
      return { players: players.sort(bySlot), teams: teams.sort((a, b) => a.team - b.team) };
    });
  }

  /** Each team's totals, in team order. */
  teamStats(replayId: string): Observable<readonly TeamStatsRow[]> {
    return this.live(async () =>
      (await this.rows<TeamStatsRow>('teamStats', replayId)).sort((a, b) => a.team - b.team),
    );
  }

  /**
   * Each player's activity (APM, pings, chat, sprays, voice lines, votes given), in slot order.
   * The activity analyser walks the replay's commands, so it runs only when first asked for.
   */
  activity(replayId: string): Observable<readonly ActivityRow[]> {
    return this.analysed(replayId, ACTIVITY_ANALYSER, async () =>
      (await this.rows<ActivityRow>('activity', replayId)).sort(bySlot),
    );
  }

  /** Each team's XP over time, by team then time; the XP analyser runs first if it hasn't. */
  xpPoints(replayId: string): Observable<readonly XpPointRow[]> {
    return this.analysed(replayId, XP_CURVE_ANALYSER, async () =>
      (await this.rows<XpPointRow>('xpPoints', replayId)).sort(
        (a, b) => a.team - b.team || a.seq - b.seq,
      ),
    );
  }

  private rows<T>(table: string, replayId: string): Promise<T[]> {
    return this.db.db.table<T>(table).where('replayId').equals(replayId).toArray();
  }

  private live<T>(query: () => Promise<T>): Observable<T> {
    return from(this.db.ready).pipe(switchMap(() => from(liveQuery(query))));
  }

  /**
   * A live query over a background analyser's tables. The analyser is asked for first: it runs
   * now if it hasn't yet, and answers from its stored run if it has.
   */
  private analysed<T>(replayId: string, analyser: string, query: () => Promise<T>): Observable<T> {
    return from(this.db.ready).pipe(
      switchMap(() => this.db.analyse(replayId, analyser)),
      switchMap(() => from(liveQuery(query))),
    );
  }
}
