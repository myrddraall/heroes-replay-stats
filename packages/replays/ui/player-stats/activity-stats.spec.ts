import { describe, expect, it } from 'vitest';
import { withActivity } from './activity-stats';

describe('activity stats', () => {
  const players = [
    { slot: 0, name: 'A', HeroDamage: 100 },
    { slot: 1, name: 'B', HeroDamage: 200 },
  ];

  it("adds each player's activity stats by slot, and nothing else of the activity row", () => {
    const activity = [{ slot: 1, name: 'other', apm: 120.5, pings: 7, team: 1 }];
    expect(withActivity(players, activity)).toEqual([
      { slot: 0, name: 'A', HeroDamage: 100 },
      { slot: 1, name: 'B', HeroDamage: 200, apm: 120.5, pings: 7 },
    ]);
  });

  it('leaves the players as they are without activity', () => {
    expect(withActivity(players, [])).toEqual(players);
  });
});
