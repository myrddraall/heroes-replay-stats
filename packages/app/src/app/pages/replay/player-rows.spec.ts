import { describe, expect, it } from 'vitest';
import { playerRows, statValues } from './player-rows';

describe('player rows', () => {
  const columns = [
    { id: 'Takedowns', label: 'Takedowns', format: 'integer' },
    { id: 'HeroDamage', label: 'Hero damage', format: 'integer' },
  ] as const;
  const player = (slot: number, team: 0 | 1, takedowns: number | null) => ({
    slot,
    name: `P${slot}`,
    hero: 'Valla',
    team,
    Takedowns: takedowns,
  });

  it("picks the columns' numbers, null for anything else", () => {
    expect(statValues({ Takedowns: 3, HeroDamage: 'x', Other: 1 }, columns)).toEqual({
      Takedowns: 3,
      HeroDamage: null,
    });
  });

  it('puts your team first, in blue, then the rest by slot', () => {
    const players = [player(0, 0, 1), player(5, 1, 2), player(1, 0, null), player(6, 1, 4)];
    const icon = { src: 'valla.png', name: 'Valla' };
    const rows = playerRows(players, { 5: icon }, columns, 1, 'relative');
    expect(rows.map((r) => [r.key, r.group, r.class])).toEqual([
      [5, 1, 'hrs-glass-blue'],
      [6, 1, 'hrs-glass-blue'],
      [0, 0, 'hrs-glass-red'],
      [1, 0, 'hrs-glass-red'],
    ]);
    expect(rows[0]!.data).toEqual({ player: players[1], icon });
    expect(rows[2]!.data.icon).toBeNull();
    expect(rows[3]!.values).toEqual({ Takedowns: null, HeroDamage: null });
  });

  it('colours the first team blue without a team of yours', () => {
    const rows = playerRows([player(5, 1, 0), player(0, 0, 0)], {}, columns, null, 'relative');
    expect(rows.map((r) => r.class)).toEqual(['hrs-glass-blue', 'hrs-glass-red']);
    expect(rows[0]!.key).toBe(0);
  });
});
