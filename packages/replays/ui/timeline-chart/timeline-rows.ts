import { type ReplayTimeline, timelineSeconds } from '../../model';
import type { DeathLane } from './death-lanes';

/** A fight: deaths close together, and who died on each side. */
export interface Fight {
  readonly start: number;
  readonly end: number;
  /** The players who died, by row (`DeathLane`), in order. */
  readonly died: readonly number[];
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
    .map((e) => ({ seconds: timelineSeconds(timeline, e.start), lane: laneOf.get(e.slot!)! }));
  const fights: { start: number; end: number; died: number[] }[] = [];
  for (const d of deaths) {
    const last = fights.at(-1);
    if (last && d.seconds - last.end <= FIGHT_GAP_SECONDS) {
      last.end = d.seconds;
      last.died.push(d.lane);
    } else fights.push({ start: d.seconds, end: d.seconds, died: [d.lane] });
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
