import type { XpPointRow } from '@myrddraall/heroprotocol-analysis';
import { describe, expect, it } from 'vitest';
import { xpTables } from './xp-rows';

describe('xp tables', () => {
  const point = (team: 0 | 1, seq: number, seconds: number, minionXP: number, heroXP: number) =>
    ({
      team,
      seq,
      seconds,
      previousSeconds: 0,
      teamLevel: seq + 1,
      minionXP,
      creepXP: 0,
      structureXP: 0,
      heroXP,
      trickleXP: 0,
      total: minionXP + heroXP,
      gained: 0,
    }) satisfies XpPointRow;

  it('gives each source the XP gained since the previous point, your team first', () => {
    const tables = xpTables(
      [point(0, 0, 60, 100, 0), point(0, 1, 120, 250, 40), point(1, 0, 60, 90, 0)],
      1,
      'relative',
    );
    expect(tables.map((t) => [t.team, t.name])).toEqual([
      [1, 'Blue team'],
      [0, 'Red team'],
    ]);
    const red = tables[1]!;
    expect(red.rows.map((r) => [r.data.time, r.values['minionXP'], r.values['heroXP']])).toEqual([
      ['1:00', 100, 0],
      ['2:00', 150, 40],
    ]);
    expect(red.rows[1]!.values['total']).toBe(290);
    expect(red.rows[1]!.class).toBe('hrs-glass-red');
  });
});
