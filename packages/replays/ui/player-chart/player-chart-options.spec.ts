import { describe, expect, it } from 'vitest';
import type { ReplayPlayer } from '../../model';
import type { ChartLook } from '../charts/chart-look';
import { apmOptions, chartPlayers } from './player-chart-options';

const players = [
  { slot: 0, name: 'A', hero: 'Valla', team: 0 },
  { slot: 1, name: 'B', hero: 'Uther', team: 0 },
  { slot: 5, name: 'C', hero: 'Muradin', team: 1 },
] as unknown as ReplayPlayer[];
const look: ChartLook = {
  font: 'sans-serif',
  label: '#ccc',
  line: '#444',
  teams: { blue: '#00f', red: '#f00' },
  extra: { 'player-colour-0': '#111', 'player-colour-1': '#222' },
};

describe('player charts', () => {
  it("gives each player their team's place colour, your team first and solid, the other dashed", () => {
    expect(chartPlayers(players, 1, 'relative').map((p) => [p.hero, p.colour, p.dashed])).toEqual([
      ['Muradin', 0, false],
      ['Valla', 0, true],
      ['Uther', 1, true],
    ]);
  });

  it('draws a line per shown player in their colour, the hidden left out', () => {
    const options = apmOptions({
      players: chartPlayers(players, 0, 'relative'),
      column: null,
      values: {},
      actions: [{ slot: 1, minute: 0, actions: 30 }],
      hidden: [0],
      durationSeconds: 60,
      look,
      locale: 'en',
    });
    const series = options.series as {
      name: string;
      data: number[][];
      lineStyle: { color: string; type: string };
    }[];
    expect(series.map((s) => [s.name, s.lineStyle.color, s.lineStyle.type, s.data])).toEqual([
      ['Uther (B)', '#222', 'solid', [[30, 30]]],
      ['Muradin (C)', '#111', 'dashed', [[30, 0]]],
    ]);
  });
});
