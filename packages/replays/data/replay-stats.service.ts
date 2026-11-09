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
import { Dexie, liveQuery } from 'dexie';
import { from, type Observable, switchMap } from 'rxjs';
import { REPLAY_DB } from '@myrddraall/heroes-replay-stats-import/data';
import {
  type ActionsPerMinute,
  type ReplayDraft,
  type ReplayPlayerStats,
  type ReplayScoreScreen,
  type ReplayTimeline,
  type ReplayUnitKills,
  type MapState,
  mapState,
} from '../model';
import type { TimelineEventRow } from '@myrddraall/heroes-replay-stats-analysers';
import {
  type CommandRecord,
  GAME_START_LOOP,
  type ReplayRecord,
  type StatEventRecord,
  type UnitRecord,
} from '@myrddraall/heroprotocol-db';

const bySlot = (a: { slot: number }, b: { slot: number }): number => a.slot - b.slot;

/** Analysers that run in the background after an import, by the tables they write. */
const CHAT_ANALYSER = '@myrddraall/chat';
const TALENTS_ANALYSER = '@myrddraall/talents';
const XP_CURVE_ANALYSER = '@myrddraall/xp-curve';
/** Gates readiness, but is asked for again when a newer version counts differently. */
const UNIT_KILLS_ANALYSER = '@myrddraall/unit-kills';
/** The app's own timeline analyser (@myrddraall/heroes-replay-stats-analysers). */
const TIMELINE_ANALYSER = '@myrddraall/timeline';
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

  /**
   * The units each player and team killed. The analyser is asked for first, so a replay stored by
   * an older version of it (which counted only the heroes still dead at the end) is counted again.
   */
  unitKills(replayId: string): Observable<ReplayUnitKills> {
    return this.analysed(replayId, UNIT_KILLS_ANALYSER, async () => {
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

  /**
   * What happened when over the game (lifespans, deaths, talents, team levels, structures, camps,
   * objectives), in game order, with the loop the game's clock starts from; the timeline analyser
   * runs first if it hasn't.
   */
  timeline(replayId: string): Observable<ReplayTimeline> {
    return this.analysed(replayId, TIMELINE_ANALYSER, async () => {
      const [replay, events] = await Promise.all([
        this.db.db.table<ReplayRecord>('replays').get(replayId),
        this.rows<TimelineEventRow>('timelineEvents', replayId),
      ]);
      return {
        startLoop: replay?.gameStartLoop ?? GAME_START_LOOP,
        events: events.sort((a, b) => a.seq - b.seq),
      };
    });
  }

  /**
   * How many commands each player gave in each minute of the game (from the gates opening), from
   * the replay's stored commands, by player then minute.
   */
  actionsPerMinute(replayId: string): Observable<readonly ActionsPerMinute[]> {
    return this.live(async () => {
      const commands = await this.db.db
        .table<CommandRecord>('commands')
        .where('[replayId+seq]')
        .between([replayId, Dexie.minKey], [replayId, Dexie.maxKey])
        .toArray();
      const counts = new Map<string, ActionsPerMinute>();
      for (const c of commands) {
        if (c.seconds < 0) continue;
        const minute = Math.floor(c.seconds / 60);
        const key = `${c.playerSlot}:${minute}`;
        const before = counts.get(key);
        counts.set(key, { slot: c.playerSlot, minute, actions: (before?.actions ?? 0) + 1 });
      }
      return [...counts.values()].sort((a, b) => a.slot - b.slot || a.minute - b.minute);
    });
  }

  /**
   * The map over the game: each camp's stretches up and captured, each town with its hall and
   * structures and when they fell, and each core; from the replay's stat events and units.
   */
  mapState(replayId: string): Observable<MapState> {
    return this.live(async () => {
      const range = (table: string) =>
        this.db.db
          .table(table)
          .where(table === 'units' ? '[replayId+tag]' : '[replayId+seq]')
          .between([replayId, Dexie.minKey], [replayId, Dexie.maxKey])
          .toArray();
      const [replay, stats, units] = await Promise.all([
        this.db.db.table<ReplayRecord>('replays').get(replayId),
        range('statEvents') as Promise<StatEventRecord[]>,
        range('units') as Promise<UnitRecord[]>,
      ]);
      return mapState(
        stats,
        units,
        replay?.gameStartLoop ?? GAME_START_LOOP,
        replay?.durationSeconds ?? 0,
      );
    });
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
