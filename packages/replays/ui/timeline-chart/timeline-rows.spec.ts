import type { TimelineEventRow } from '@myrddraall/heroes-replay-stats-analysers';
import { describe, expect, it } from 'vitest';
import type { ReplayTimeline } from '../../model';
import type { DeathLane } from './death-lanes';
import { fightPlayers, replayFights, replayTalentPicks } from './timeline-rows';

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
  { slot: 1, name: 'D', hero: 'Uther', team: 0, color: 'blue' },
  { slot: 5, name: 'B', hero: 'Muradin', team: 1, color: 'red' },
  { slot: 6, name: 'C', hero: 'Genji', team: 1, color: 'red' },
];

describe('timeline rows', () => {
  it('groups deaths within 20 seconds of each other into fights, two deaths or more', () => {
    const fights = replayFights(
      timeline([
        // PlayerIDs are slots from 1; Uther (2) credited with Valla's death is her teammate: not counted
        // killing blows: Valla's, a tower's (no player), and none known
        event({
          kind: 'death',
          start: at(100),
          slot: 5,
          killers: [1, 2],
          killerSlot: 0,
          unitType: 'HeroValla',
        }),
        event({
          kind: 'death',
          start: at(115),
          slot: 0,
          killers: [6, 2],
          unitType: 'TownCannonTowerL2',
        }),
        event({ kind: 'death', start: at(130), slot: 6, killers: [2] }),
        // a pick-off on its own
        event({ kind: 'death', start: at(300), slot: 6 }),
      ]),
      lanes,
    );
    expect(fights).toEqual([
      {
        start: 100,
        end: 130,
        died: [2, 0, 3],
        credited: [0, 1, 2, 1],
        blows: [
          { victim: 2, lane: 0, other: null },
          { victim: 0, lane: null, other: 'Towers' },
        ],
      },
    ]);
    expect(fightPlayers(fights[0]!)).toEqual([2, 0, 3, 1]);
  });

  it("puts each talent pick on its player's row at its level", () => {
    expect(
      replayTalentPicks(
        timeline([event({ kind: 'talent', start: at(185), slot: 6, level: 4 })]),
        lanes,
      ),
    ).toEqual([{ lane: 3, level: 4, seconds: 185 }]);
  });
});
