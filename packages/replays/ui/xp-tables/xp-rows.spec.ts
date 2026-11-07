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
    expect(tables.map((t) => [t.team, t.color, t.name])).toEqual([
      [1, 'blue', 'Blue team'],
      [0, 'red', 'Red team'],
    ]);
    const red = tables[1]!;
    expect(red.rows.map((r) => [r.values['seconds'], r.values['minionXP'], r.values['heroXP']])).toEqual([
      [60, 100, 0],
      [120, 150, 40],
    ]);
    // each row headed by its team, in its colour from your point of view
    expect(red.rows[0]!.data).toEqual({ color: 'red', name: 'Red team' });
    expect(red.rows[1]!.values['total']).toBe(290);
    expect(red.rows[1]!.theme).toBe('red');
  });
});
