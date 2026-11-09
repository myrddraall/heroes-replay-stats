import type { TimelineEventRow } from '@myrddraall/heroes-replay-stats-analysers';
import { describe, expect, it } from 'vitest';
import type { MapState } from '../../model';
import type { ReplayDeaths } from './death-lanes';
import { gameTimeline } from './game-timeline';

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

describe('game timeline', () => {
  const deaths: ReplayDeaths = {
    lanes: [
      { slot: 0, name: 'A', hero: 'Valla', team: 0, color: 'blue' },
      { slot: 5, name: 'B', hero: 'Muradin', team: 1, color: 'red' },
    ],
    spans: [{ lane: 0, start: 100, end: 130, killers: [5], killerSlot: 5, killedBy: null }],
    takedowns: [],
  };
  const map: MapState = {
    camps: [
      {
        id: 1,
        type: 'Siege Camp',
        spans: [
          { start: 60, end: 200, team: null },
          { start: 200, end: 300, team: 1 },
        ],
      },
    ],
    towns: [
      {
        id: 1,
        team: 0,
        lane: 1,
        place: 'top',
        hall: 'fort',
        fell: 400,
        holds: [{ start: -38.125, end: 400, team: 0 }],
        losses: [],
      },
    ],
    cores: [{ team: 0, fell: 600 }],
  };
  const game = gameTimeline({
    timeline: {
      startLoop: 610,
      events: [
        // both of the blue team's level 2s count once: when the team got there
        event({ kind: 'level', start: at(50), slot: 0, level: 2 }),
        event({ kind: 'level', start: at(50), slot: 0, level: 1 }),
        event({ kind: 'talent', start: at(20), slot: 5, talent: 'MuradinSlam', level: 1 }),
        // Valla drops while dead and comes back after; Muradin drops for a while
        event({ kind: 'disconnected', start: at(120), end: at(140), slot: 0 }),
        event({ kind: 'disconnected', start: at(250), end: at(350), slot: 5 }),
      ],
    },
    deaths,
    map,
    talentNames: { MuradinSlam: 'Perfect Storm' },
    colorOf: (team) => (team === 0 ? 'blue' : team === 1 ? 'red' : null),
    teamName: (color) => (color === 'blue' ? 'Blue team' : 'Red team'),
    durationSeconds: 600,
  });

  it("starts at the replay's start, before the gates open", () => {
    expect(game.start).toBe(-38.125);
  });

  it("puts each team's row before its players' rows", () => {
    expect(game.rows).toEqual([
      { kind: 'team', team: 0, color: 'blue' },
      { kind: 'player', lane: 0 },
      { kind: 'team', team: 1, color: 'red' },
      { kind: 'player', lane: 1 },
    ]);
  });

  it('gives each team a stretch until its defeat, and each player stretches alive or dead, connected or not', () => {
    const death = deaths.spans[0]!;
    expect(game.life).toEqual([
      // the teams until their defeat: blue's core fell at 600 (the end), red's stood
      { row: 0, start: -38.125, end: 600, dead: false, disconnected: false, death: null },
      { row: 2, start: -38.125, end: 600, dead: false, disconnected: false, death: null },
      { row: 1, start: -38.125, end: 100, dead: false, disconnected: false, death: null },
      { row: 1, start: 100, end: 120, dead: true, disconnected: false, death },
      { row: 1, start: 120, end: 130, dead: true, disconnected: true, death },
      { row: 1, start: 130, end: 140, dead: false, disconnected: true, death: null },
      { row: 1, start: 140, end: 600, dead: false, disconnected: false, death: null },
      { row: 3, start: -38.125, end: 250, dead: false, disconnected: false, death: null },
      { row: 3, start: 250, end: 350, dead: false, disconnected: true, death: null },
      { row: 3, start: 350, end: 600, dead: false, disconnected: false, death: null },
    ]);
  });

  it("marks the gates opening, the teams' levels, captures, structures and result and the players' talents", () => {
    expect(game.events).toEqual([
      { row: 0, kind: 'gates', seconds: 0, title: 'Gates open', mark: null, details: [] },
      { row: 2, kind: 'gates', seconds: 0, title: 'Gates open', mark: null, details: [] },
      {
        row: 3,
        kind: 'talent',
        seconds: 20,
        title: 'Talent pick',
        mark: null,
        details: ['Perfect Storm', 'Level 1'],
      },
      { row: 0, kind: 'level', seconds: 50, title: 'Team level', mark: '2', details: ['Level 2'] },
      {
        row: 2,
        kind: 'camp',
        seconds: 200,
        title: 'Camp captured',
        mark: null,
        details: ['Siege Camp'],
      },
      {
        row: 0,
        kind: 'structure',
        seconds: 400,
        title: 'Fort lost',
        mark: null,
        details: ["Blue team's Top town"],
      },
      {
        row: 2,
        kind: 'structure',
        seconds: 400,
        title: 'Fort destroyed',
        mark: null,
        details: ["Blue team's Top town"],
      },
      {
        row: 0,
        kind: 'result',
        seconds: 600,
        title: 'Defeat',
        mark: null,
        details: ["Blue team's core destroyed"],
      },
      {
        row: 2,
        kind: 'result',
        seconds: 600,
        title: 'Victory',
        mark: null,
        details: ["Blue team's core destroyed"],
      },
    ]);
  });
});
