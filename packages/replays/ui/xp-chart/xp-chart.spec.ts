import type { XpPointRow } from '@myrddraall/heroprotocol-analysis';
import { describe, expect, it } from 'vitest';
import { TEAM_LEVEL_XP, teamLevelAt } from '../../model';
import type { ChartLook } from '../charts/chart-look';
import { niceCeiling } from '../charts/chart-options';
import { gameEvents } from '../charts/game-events';
import type { ReplayPlayer, ReplayTimeline } from '../../model';
import type { TimelineEventRow } from '@myrddraall/heroes-replay-stats-analysers';
import {
  xpAdvantageOptions,
  xpChartOptions,
  type XpChartModel,
  xpRateOptions,
  xpSourcesOptions,
  withCrossings,
} from './xp-chart-options';
import { XP_SOURCES, xpCurves } from './xp-curves';

const point = (
  team: 0 | 1,
  seq: number,
  seconds: number,
  previousSeconds: number,
  minionXP: number,
  heroXP: number,
) =>
  ({
    team,
    seq,
    seconds,
    previousSeconds,
    teamLevel: seq + 1,
    minionXP,
    creepXP: 0,
    structureXP: 0,
    heroXP,
    trickleXP: 0,
    total: minionXP + heroXP,
    gained: 0,
  }) satisfies XpPointRow;

const all = XP_SOURCES.map((s) => s.id);
const look: ChartLook = {
  font: 'sans-serif',
  label: '#ccc',
  line: '#444',
  teams: { blue: '#00f', red: '#f00' },
  extra: {},
};
const base: Omit<XpChartModel, 'curves' | 'chosen'> = {
  look,
  locale: 'en',
  events: [],
  team: null,
};

describe('team level XP', () => {
  it("runs the game's curve up to level 30", () => {
    expect(TEAM_LEVEL_XP[0]).toEqual({ level: 2, xp: 2010 });
    expect(TEAM_LEVEL_XP.find((l) => l.level === 10)?.xp).toBe(23838);
    expect(TEAM_LEVEL_XP.at(-1)).toEqual({ level: 30, xp: 241801 });
    expect([teamLevelAt(0), teamLevelAt(2010), teamLevelAt(241801)]).toEqual([1, 2, 30]);
  });
});

describe('xp curves', () => {
  const points = [
    point(0, 0, 60, 0, 100, 0),
    point(0, 1, 120, 60, 250, 40),
    // the end of the game, half a minute later
    point(0, 2, 150, 120, 300, 40),
    point(1, 0, 60, 0, 90, 0),
  ];

  it('counts the chosen sources so far and their rate per minute, your team first', () => {
    const curves = xpCurves(points, all, 1, 'relative');
    expect(curves.map((c) => [c.team, c.color, c.name])).toEqual([
      [1, 'blue', 'Blue team'],
      [0, 'red', 'Red team'],
    ]);
    expect(curves[1]!.points.map((p) => [p.seconds, p.xp, p.perMinute])).toEqual([
      [60, 100, 100],
      [120, 290, 190],
      [150, 340, 100],
    ]);
    expect(xpCurves(points, ['heroXP'], 1, 'relative')[1]!.points.map((p) => p.xp)).toEqual([
      0, 40, 40,
    ]);
  });
});

describe('xp chart options', () => {
  const curves = xpCurves(
    [point(0, 0, 60, 0, 3000, 0), point(0, 1, 120, 60, 5000, 0), point(1, 0, 60, 0, 2500, 0)],
    all,
    0,
    'relative',
  );
  const axes = (o: ReturnType<typeof xpChartOptions>) =>
    o.yAxis as { show?: boolean; max?: number; axisLabel?: { customValues?: number[] } }[];

  it('rounds the XP axis up', () => {
    expect([niceCeiling(4164), niceCeiling(87321), niceCeiling(0)]).toEqual([4200, 88000, 1]);
  });

  it('ticks the level axis at the XP each level is reached, on the XP axis scale', () => {
    const options = xpChartOptions({ ...base, curves, chosen: all });
    const [xp, level] = axes(options);
    expect(xp!.max).toBe(5000);
    expect(level!.max).toBe(5000);
    expect(level!.show).toBe(true);
    expect(level!.axisLabel?.customValues).toEqual([2010, 4164]);
    // each line starts at no XP when the gates open
    const series = options.series as { data: number[][] }[];
    expect(series[0]!.data).toEqual([
      [0, 0],
      [60, 3000],
      [120, 5000],
    ]);
  });

  it('hides the level axis when not every source is counted', () => {
    const options = xpChartOptions({ ...base, curves, chosen: ['minionXP'] });
    expect(axes(options)[1]!.show).toBe(false);
  });

  it("draws each team's XP per minute as its own line", () => {
    const options = xpRateOptions({ ...base, curves, chosen: all });
    const series = options.series as { name: string; data: number[][] }[];
    expect(series.map((s) => [s.name, s.data])).toEqual([
      [
        'Blue team',
        [
          [60, 3000],
          [120, 2000],
        ],
      ],
      ['Red team', [[60, 2500]]],
    ]);
  });

  it('draws the lead from the middle, the first team above it and the second below', () => {
    const options = xpAdvantageOptions({ ...base, curves, chosen: all });
    const [above, below] = options.series as { name: string; data: { value: number[] }[] }[];
    expect([above!.name, above!.data.map((d) => d.value)]).toEqual([
      'Blue team',
      [
        [0, 0],
        [60, 500],
      ],
    ]);
    expect(below!.data.map((d) => d.value)).toEqual([
      [0, 0],
      [60, 0],
    ]);
    const axis = options.yAxis as { min: number; max: number };
    expect([axis.min, axis.max]).toEqual([-500, 500]);
  });

  it('bends the lead through the middle where it changes hands', () => {
    expect(
      withCrossings([
        [0, 0],
        [60, 300],
        [120, -100],
      ]),
    ).toEqual([
      { seconds: 0, lead: 0, point: true },
      { seconds: 60, lead: 300, point: true },
      { seconds: 105, lead: 0, point: false },
      { seconds: 120, lead: -100, point: true },
    ]);
  });

  it("stacks the team's counted sources from the bottom in the checked order", () => {
    const options = xpSourcesOptions({ ...base, curves, chosen: ['heroXP', 'minionXP'], team: 0 });
    const series = options.series as { name: string; stack: string; data: number[][] }[];
    expect(series.map((s) => [s.name, s.stack, s.data.at(-1)])).toEqual([
      ['Minions', 'xp', [120, 5000]],
      ['Heroes', 'xp', [120, 0]],
    ]);
  });
});

describe('game events', () => {
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
  const timeline: ReplayTimeline = {
    startLoop: 610,
    events: [
      event({ kind: 'team-level', start: 610 + 16 * 60, team: 1, level: 4 }),
      event({ kind: 'team-level', start: 610 + 16 * 61, team: 1, level: 5 }),
      event({
        kind: 'structure-death',
        start: 610 + 16 * 300,
        team: 0,
        unitType: 'TownTownHallL2',
      }),
      event({
        kind: 'structure-death',
        start: 610 + 16 * 301,
        team: 0,
        unitType: 'TownCannonTowerL2',
      }),
      event({ kind: 'death', start: 610 + 16 * 400, slot: 3, team: 0 }),
    ],
  };
  const players = [{ slot: 3, name: 'Erd', hero: 'Valla', team: 0 }] as unknown as ReplayPlayer[];

  it('lists talent tiers, forts and keeps, and deaths, in the colour of the team they were about', () => {
    expect(gameEvents(timeline, players, 1, 'relative')).toEqual([
      { seconds: 60, color: 'blue', text: 'Blue team reached level 4' },
      { seconds: 300, color: 'red', text: 'Red team destroyed a fort' },
      { seconds: 400, color: 'red', text: 'Valla (Erd) died' },
    ]);
  });
});
