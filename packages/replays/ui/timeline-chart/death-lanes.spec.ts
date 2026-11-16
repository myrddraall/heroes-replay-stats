import type { TimelineEventRow } from '@myrddraall/heroes-replay-stats-analysers';
import { describe, expect, it } from 'vitest';
import type { ReplayPlayer, ReplayTimeline } from '../../model';
import { replayDeaths } from './death-lanes';

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
const players = [
  { slot: 0, name: 'A', hero: 'Valla', team: 0 },
  { slot: 1, name: 'B', hero: 'Uther', team: 0 },
  { slot: 5, name: 'C', hero: 'Muradin', team: 1 },
  { slot: 6, name: 'D', hero: 'Genji', team: 1 },
] as unknown as ReplayPlayer[];

describe('replay deaths', () => {
  const timeline: ReplayTimeline = {
    startLoop: 610,
    events: [
      event({ kind: 'dead', start: at(100), end: at(130), slot: 0, team: 0 }),
      // the game's PlayerIDs are slots from 1; an ally's credit is dropped
      event({ kind: 'death', start: at(100), slot: 0, team: 0, killers: [6, 7, 2], killerSlot: 5 }),
      event({ kind: 'dead', start: at(200), end: at(220), slot: 6, team: 1 }),
      event({
        kind: 'death',
        start: at(200),
        slot: 6,
        team: 1,
        killers: [1],
        unitType: 'TownCannonTowerL3',
      }),
      event({ kind: 'death', start: at(300), slot: 0, team: 0, killers: [6] }),
    ],
  };

  it('puts your team first, each dead stretch on its player, with the enemies credited', () => {
    const deaths = replayDeaths(timeline, players, 1, 'relative');
    expect(deaths.lanes.map((l) => [l.hero, l.color])).toEqual([
      ['Muradin', 'blue'],
      ['Genji', 'blue'],
      ['Valla', 'red'],
      ['Uther', 'red'],
    ]);
    expect(deaths.spans).toEqual([
      { lane: 2, start: 100, end: 130, killers: [5, 6], killerSlot: 5, killedBy: null },
      { lane: 1, start: 200, end: 220, killers: [0], killerSlot: null, killedBy: 'Towers' },
    ]);
  });

  it('counts how many times each player took part in killing each enemy', () => {
    const { takedowns } = replayDeaths(timeline, players, 1, 'relative');
    expect(takedowns).toEqual([
      { killer: 5, victim: 0, count: 2 },
      { killer: 6, victim: 0, count: 1 },
      { killer: 0, victim: 6, count: 1 },
    ]);
  });
});
