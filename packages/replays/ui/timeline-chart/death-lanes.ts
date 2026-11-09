import type { Team } from '@myrddraall/heroprotocol-db';
import {
  type ReplayPlayer,
  type ReplayTimeline,
  type TeamColor,
  teamColor,
  type TeamColorMode,
  timelineSeconds,
} from '../../model';

/** A player's row: who they are, on which side, in their team's colour from your point of view. */
export interface DeathLane {
  readonly slot: number;
  readonly name: string;
  readonly hero: string;
  readonly team: Team | null;
  readonly color: TeamColor | null;
}

/** A stretch a player spent dead, on the game's clock, and who the game credits with the kill. */
export interface DeadSpan {
  /** The player's row. */
  readonly lane: number;
  readonly start: number;
  readonly end: number;
  /** The slots of the enemy players credited with the takedown. */
  readonly killers: readonly number[];
}

/** How many times one player took part in killing another. */
export interface Takedowns {
  readonly killer: number;
  readonly victim: number;
  readonly count: number;
}

/** A replay's deaths, by player. */
export interface ReplayDeaths {
  /** Your team first, each in slot order. */
  readonly lanes: readonly DeathLane[];
  readonly spans: readonly DeadSpan[];
  readonly takedowns: readonly Takedowns[];
}

/** How far apart (in game loops) a death and the dead stretch it starts may be and still match. */
const SAME_DEATH_LOOPS = 16;

/**
 * The replay's deaths from its timeline: each player's dead stretches with the enemies credited for
 * them, and how many times each player took part in killing each enemy.
 */
export function replayDeaths(
  timeline: ReplayTimeline,
  players: readonly ReplayPlayer[],
  yourTeam: Team | null,
  mode: TeamColorMode,
): ReplayDeaths {
  const lanes: DeathLane[] = players
    .map((p) => ({
      slot: p.slot,
      name: p.name,
      hero: p.hero,
      team: p.team,
      color: p.team === null ? null : teamColor(p.team, yourTeam, mode),
    }))
    .sort((a, b) => Number(a.color !== 'blue') - Number(b.color !== 'blue') || a.slot - b.slot);
  const laneOf = new Map(lanes.map((l, i) => [l.slot, i]));
  const teamOf = new Map(players.map((p) => [p.slot, p.team]));
  const seconds = (loop: number) => timelineSeconds(timeline, loop);

  const deaths = timeline.events.filter((e) => e.kind === 'death' && e.slot !== null);
  /** The enemy slots credited with a death: the game's PlayerIDs are slots from 1. */
  const killersOf = (slot: number, loop: number): number[] => {
    const death = deaths.find(
      (d) => d.slot === slot && Math.abs(d.start - loop) <= SAME_DEATH_LOOPS,
    );
    return (death?.killers ?? [])
      .filter((id) => id >= 1 && id <= 10)
      .map((id) => id - 1)
      .filter((killer) => teamOf.has(killer) && teamOf.get(killer) !== teamOf.get(slot));
  };

  const spans = timeline.events.flatMap((e): DeadSpan[] => {
    if (e.kind !== 'dead' || e.slot === null) return [];
    const lane = laneOf.get(e.slot);
    if (lane === undefined) return [];
    return [
      {
        lane,
        start: seconds(e.start),
        end: seconds(e.end ?? e.start),
        killers: killersOf(e.slot, e.start),
      },
    ];
  });

  const counts = new Map<string, Takedowns>();
  for (const d of deaths) {
    const victim = d.slot!;
    for (const killer of killersOf(victim, d.start)) {
      const key = `${killer}>${victim}`;
      const before = counts.get(key);
      counts.set(key, { killer, victim, count: (before?.count ?? 0) + 1 });
    }
  }

  return { lanes, spans, takedowns: [...counts.values()] };
}
