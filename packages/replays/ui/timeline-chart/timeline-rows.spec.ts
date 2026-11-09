import type { TimelineEventRow } from '@myrddraall/heroes-replay-stats-analysers';
import { describe, expect, it } from 'vitest';
import type { ReplayTimeline } from '../../model';
import type { DeathLane } from './death-lanes';
import { replayFights, replayTalentPicks } from './timeline-rows';

const event = (e: Partial<TimelineEventRow> & Pick<TimelineEventRow, 'kind' | 'start'>) =>
  ({
    seq: 0,
    end: null,
    slot: null,
    team: null,
    level: null,
    talent: null,
    killers: null,
    x: null,
    y: null,
    unitType: null,
    townId: null,
    killerSlot: null,
    campId: null,
    campType: null,
    name: null,
    values: null,
    ...e,
  }) satisfies TimelineEventRow;
const at = (seconds: number) => 610 + 16 * seconds;
const timeline = (events: TimelineEventRow[]): ReplayTimeline => ({ startLoop: 610, events });
const lanes: DeathLane[] = [
  { slot: 0, name: 'A', hero: 'Valla', team: 0, color: 'blue' },
  { slot: 5, name: 'B', hero: 'Muradin', team: 1, color: 'red' },
  { slot: 6, name: 'C', hero: 'Genji', team: 1, color: 'red' },
];

describe('timeline rows', () => {
  it('groups deaths within 20 seconds of each other into fights, two deaths or more', () => {
    const fights = replayFights(
      timeline([
        event({ kind: 'death', start: at(100), slot: 5 }),
        event({ kind: 'death', start: at(115), slot: 0 }),
        event({ kind: 'death', start: at(130), slot: 6 }),
        // a pick-off on its own
        event({ kind: 'death', start: at(300), slot: 6 }),
      ]),
      lanes,
    );
    expect(fights).toEqual([{ start: 100, end: 130, died: [1, 0, 2] }]);
  });

  it("puts each talent pick on its player's row at its level", () => {
    expect(
      replayTalentPicks(
        timeline([event({ kind: 'talent', start: at(185), slot: 6, level: 4 })]),
        lanes,
      ),
    ).toEqual([{ lane: 2, level: 4, seconds: 185 }]);
  });
});
