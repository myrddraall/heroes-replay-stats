import { describe, expect, it } from 'vitest';
import { teamName, teamRows } from './team-rows';

describe('team rows', () => {
  const columns = [{ id: 'total', label: 'Total', format: 'integer' }] as const;
  const teams = [
    { team: 0 as const, total: 10 },
    { team: 1 as const, total: 20 },
  ];

  it('names a team by its colour', () => {
    expect(teamName('blue')).toBe('Blue team');
    expect(teamName('red')).toBe('Red team');
  });

  it('puts your team first, in blue, with its stats', () => {
    expect(teamRows(teams, columns, 1, 'relative')).toEqual([
      {
        key: 1,
        group: null,
        values: { total: 20 },
        theme: 'blue',
        data: { team: 1, color: 'blue', name: 'Blue team' },
      },
      {
        key: 0,
        group: null,
        values: { total: 10 },
        theme: 'red',
        data: { team: 0, color: 'red', name: 'Red team' },
      },
    ]);
  });

  it('colours the first team blue without a "you"', () => {
    expect(teamRows(teams, columns, null, 'relative').map((r) => r.data.name)).toEqual([
      'Blue team',
      'Red team',
    ]);
  });
});
