import type { TimelineEventRow } from '@myrddraall/heroes-replay-stats-analysers';
import { gameSeconds } from '@myrddraall/heroprotocol-db';

/** A replay's timeline, as the app's timeline analyser stored it. */
export interface ReplayTimeline {
  /** The loop the game's clock starts from (the gates opening). */
  readonly startLoop: number;
  /** In game order; times are game loops. */
  readonly events: readonly TimelineEventRow[];
}

/** A timeline loop on the game's clock, in seconds. */
export function timelineSeconds(timeline: ReplayTimeline, loop: number): number {
  return gameSeconds(loop, timeline.startLoop);
}
