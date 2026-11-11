import type { TeamStatsRow } from '@myrddraall/heroprotocol-analysis';
import { describe, expect, it } from 'vitest';
import { TEAM_STAT_GROUPS, teamStatRows } from './team-stat-groups';

describe('team stat groups', () => {
  const columns = [
    { id: 'kills', label: 'Kills', format: 'integer' },
    { id: 'firstFortSeconds', label: 'First Fort', format: 'clock' },
  ] as const;
  const team = (t: 0 | 1, won: boolean, kills: number, firstFortSeconds: number | null) =>
    ({ team: t, won, kills, firstFortSeconds }) as unknown as TeamStatsRow;

  it('names each column once, over all the groups', () => {
    const ids = TEAM_STAT_GROUPS.flatMap((g) => g.columns.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('puts your team first, in blue, with its result and stats', () => {
    expect(teamStatRows([team(0, true, 20, 600), team(1, false, 12, null)], columns, 1, 'relative'))
      .toEqual([
        {
          key: 1,
          group: null,
          values: { kills: 12, firstFortSeconds: null },
          theme: 'blue',
          data: { team: 1, color: 'blue', name: 'Blue team', result: 'Defeat' },
        },
        {
          key: 0,
          group: null,
          values: { kills: 20, firstFortSeconds: 600 },
          theme: 'red',
          data: { team: 0, color: 'red', name: 'Red team', result: 'Victory' },
        },
      ]);
  });

  it('gives no result when the replay does not say who won', () => {
    const rows = teamStatRows([team(0, false, 0, null), team(1, false, 0, null)], columns, null, 'relative');
    expect(rows.map((r) => r.data.result)).toEqual([null, null]);
  });
});
