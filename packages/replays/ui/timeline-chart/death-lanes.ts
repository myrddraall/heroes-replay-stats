import type { Team } from '@myrddraall/heroprotocol-db';
import {
  type ReplayPlayer,
  structureKind,
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
  /** The slot of the enemy player who landed the killing blow; null when no player did. */
  readonly killerSlot: number | null;
  /** What landed the killing blow when no player did (`Towers`, `Mercenaries`); null otherwise. */
  readonly killedBy: string | null;
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

/** The kind of unit that landed a killing blow, by its type, when no player did. */
export function killerKind(type: string): string {
  const kind = structureKind(type);
  if (kind === 'tower') return 'Towers';
  if (kind === 'fort') return 'Forts';
  if (kind === 'keep') return 'Keeps';
  if (kind !== null) return 'Structures';
  if (/Minion/.test(type)) return 'Minions';
  if (type.startsWith('Merc')) return 'Mercenaries';
  return 'Map units';
}

/** A player's slot from the game's PlayerID (slots from 1); null for the teams' own players. */
export function playerIdSlot(id: number): number | null {
  return id >= 1 && id <= 10 ? id - 1 : null;
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
  const deathAt = (slot: number, loop: number) =>
    deaths.find((d) => d.slot === slot && Math.abs(d.start - loop) <= SAME_DEATH_LOOPS);
  const killersOf = (slot: number, loop: number): number[] => {
    const death = deathAt(slot, loop);
    return (death?.killers ?? [])
      .map(playerIdSlot)
      .filter((k) => k !== null && teamOf.has(k) && teamOf.get(k) !== teamOf.get(slot))
      .map((k) => k!);
  };

  const spans = timeline.events.flatMap((e): DeadSpan[] => {
    if (e.kind !== 'dead' || e.slot === null) return [];
    const lane = laneOf.get(e.slot);
    if (lane === undefined) return [];
    const death = deathAt(e.slot, e.start);
    const killerSlot = death?.killerSlot ?? null;
    // no player's: another unit's, but not the victim's own hero (Uther's spirit)
    const other = killerSlot === null ? (death?.unitType ?? null) : null;
    return [
      {
        lane,
        start: seconds(e.start),
        end: seconds(e.end ?? e.start),
        killers: killersOf(e.slot, e.start),
        killerSlot,
        killedBy: other !== null && !other.startsWith('Hero') ? killerKind(other) : null,
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
