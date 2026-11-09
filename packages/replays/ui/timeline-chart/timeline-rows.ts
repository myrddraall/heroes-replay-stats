import { type ReplayTimeline, structureKind, timelineSeconds } from '../../model';
import { type DeathLane, playerIdSlot } from './death-lanes';

/** Who landed a death's killing blow: an enemy player, or another of the enemy's units. */
export interface KillingBlow {
  /** The dead player's row. */
  readonly victim: number;
  /** The killer's row when an enemy player landed it; null otherwise. */
  readonly lane: number | null;
  /** What landed it when no player did (`Towers`, `Mercenaries`); null for a player's. */
  readonly other: string | null;
}

/** A fight: deaths close together, who died on each side, and who the game credited for them. */
export interface Fight {
  readonly start: number;
  readonly end: number;
  /** The players who died, by row (`DeathLane`), in order; a player dying twice is here twice. */
  readonly died: readonly number[];
  /** The enemies credited with a takedown, by row, once for each death they took part in. */
  readonly credited: readonly number[];
  /** Each death's killing blow, where the replay has it (not Leoric's: his hero never dies). */
  readonly blows: readonly KillingBlow[];
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

/** The players who took part in a fight, by row: each who died or was credited with a takedown. */
export function fightPlayers(fight: Fight): number[] {
  return [...new Set([...fight.died, ...fight.credited])];
}

/** How long (seconds) between one death and the next for both to be the same fight. */
export const FIGHT_GAP_SECONDS = 20;

/**
 * The game's fights: deaths each within `FIGHT_GAP_SECONDS` of the one before, two or more (one is
 * a pick-off, not a fight).
 */
export function replayFights(timeline: ReplayTimeline, lanes: readonly DeathLane[]): Fight[] {
  const laneOf = new Map(lanes.map((l, i) => [l.slot, i]));
  const deaths = timeline.events
    .filter((e) => e.kind === 'death' && e.slot !== null && laneOf.has(e.slot))
    .map((e) => {
      const lane = laneOf.get(e.slot!)!;
      const credited = (e.killers ?? [])
        .map((id) => laneOf.get(playerIdSlot(id) ?? -1))
        .filter((k) => k !== undefined && lanes[k]!.team !== lanes[lane]!.team)
        .map((k) => k!);
      const killer = e.killerSlot === null ? undefined : laneOf.get(e.killerSlot);
      // an enemy player's, or another unit's; a hero with no enemy player is the victim's own
      // (Uther's spirit) or not known
      const blow: KillingBlow | null =
        killer !== undefined
          ? { victim: lane, lane: killer, other: null }
          : e.unitType !== null && !e.unitType.startsWith('Hero')
            ? { victim: lane, lane: null, other: killerKind(e.unitType) }
            : null;
      return { seconds: timelineSeconds(timeline, e.start), lane, credited, blow };
    });
  const fights: {
    start: number;
    end: number;
    died: number[];
    credited: number[];
    blows: KillingBlow[];
  }[] = [];
  for (const d of deaths) {
    const last = fights.at(-1);
    const blows = d.blow ? [d.blow] : [];
    if (last && d.seconds - last.end <= FIGHT_GAP_SECONDS) {
      last.end = d.seconds;
      last.died.push(d.lane);
      last.credited.push(...d.credited);
      last.blows.push(...blows);
    } else
      fights.push({
        start: d.seconds,
        end: d.seconds,
        died: [d.lane],
        credited: [...d.credited],
        blows,
      });
  }
  return fights.filter((f) => f.died.length >= 2);
}

/** A talent pick: whose (their row), at which level, when. */
export interface TalentPick {
  readonly lane: number;
  readonly level: number;
  readonly seconds: number;
}

/** Each player's talent picks, by the level they were picked at. */
export function replayTalentPicks(
  timeline: ReplayTimeline,
  lanes: readonly DeathLane[],
): TalentPick[] {
  const laneOf = new Map(lanes.map((l, i) => [l.slot, i]));
  return timeline.events.flatMap((e): TalentPick[] => {
    if (e.kind !== 'talent' || e.slot === null || e.level === null) return [];
    const lane = laneOf.get(e.slot);
    return lane === undefined
      ? []
      : [{ lane, level: e.level, seconds: timelineSeconds(timeline, e.start) }];
  });
}
