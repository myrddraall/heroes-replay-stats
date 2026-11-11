import { describe, expect, it } from 'vitest';
import type { ReplaySummary } from '@myrddraall/heroes-replay-stats-replays/model';
import {
  aggregateStat,
  aggregateStats,
  awardCounts,
  groupGames,
  isSummed,
  playerPeers,
  playerRecords,
  winLoss,
} from './player-aggregates';
import { playerGames, type PlayerGame, type PlayerGameRows } from './player-game';

const replay = (id: string, over: Partial<ReplaySummary> = {}): ReplaySummary => ({
  id,
  map: 'Sky Temple',
  mode: 'quick-match',
  playedAt: `2024-03-0${id}T00:00:00.000Z`,
  importedAt: '2024-04-01T00:00:00.000Z',
  durationSeconds: 1200,
  winningTeam: 0,
  build: 90000,
  status: 'complete',
  players: [],
  recorderToonHandle: null,
  outdated: false,
  ...over,
});

const game = (id: string, over: Partial<PlayerGame> = {}): PlayerGame => ({
  replay: replay(id),
  you: { slots: [0], team: 0 },
  slot: 0,
  name: 'Ann',
  hero: 'Jaina',
  heroId: 'Jaina',
  role: 'assassin',
  team: 0,
  won: true,
  stats: null,
  awards: [],
  mvp: false,
  ...over,
});

const deaths = { id: 'Deaths', format: 'integer', better: 'lower' } as const;
const kda = { id: 'KDARatio', format: 'decimal', better: 'higher' } as const;

describe('playerGames', () => {
  const player = (replayId: string, kind = 'player') =>
    ({ replayId, slot: 3, kind, team: 1, name: 'Ann', hero: 'Jaina', heroId: 'Jaina', role: null, won: false }) as unknown as PlayerGameRows['players'][number];

  it('joins their rows with the replays that can be opened, most recent first', () => {
    const rows: PlayerGameRows = {
      players: [player('1'), player('2'), player('9'), player('3', 'observer')],
      stats: { '2': { Deaths: 4 } as never },
      scores: { '2': { awards: ['MVP', 'MostHealing'], mvp: true } },
    };
    const games = playerGames(rows, [replay('1'), replay('2'), replay('3')]);
    expect(games.map((g) => g.replay.id)).toEqual(['2', '1']);
    expect(games[0]).toMatchObject({
      you: { slots: [3], team: 1 },
      stats: { Deaths: 4 },
      awards: ['MostHealing'],
      mvp: true,
    });
    expect(games[1]).toMatchObject({ stats: null, awards: [], mvp: false });
  });
});

describe('winLoss', () => {
  it('counts results, the share won of those with one', () => {
    const games = [game('1'), game('2', { won: false }), game('3', { won: null }), game('4')];
    expect(winLoss(games)).toEqual({ wins: 2, losses: 1, winRate: 2 / 3 });
    expect(winLoss([game('1', { won: null })]).winRate).toBeNull();
  });
});

describe('aggregateStat', () => {
  const games = [
    game('1', { stats: { Deaths: 2, KDARatio: 4 } }),
    game('2', { stats: { Deaths: 6, KDARatio: 1 } }),
    game('3', { stats: { Deaths: null } }),
    game('4'),
  ];

  it('takes the mean, the sum or the best of the matches that have the stat', () => {
    expect(aggregateStat(games, deaths, 'average')).toBe(4);
    expect(aggregateStat(games, deaths, 'total')).toBe(8);
    expect(aggregateStat(games, deaths, 'best')).toBe(2); // lower is better
    expect(aggregateStat(games, kda, 'best')).toBe(4);
    expect(aggregateStat(games, { id: 'Healing', format: 'integer' }, 'average')).toBeNull();
  });

  it('sums only counts and times', () => {
    expect(aggregateStat(games, kda, 'total')).toBeNull();
    expect(isSummed({ id: 'TimeSpentDead', format: 'duration' })).toBe(true);
    expect(isSummed({ id: 'AverageHeroDamagePerLife', format: 'integer' })).toBe(false);
    expect(isSummed({ id: 'HighestKillStreak', format: 'integer' })).toBe(false);
    expect(isSummed({ id: 'KillParticipation', format: 'percent' })).toBe(false);
  });

  it("reads a match's length from the replay", () => {
    expect(aggregateStat(games, { id: 'length', format: 'clock' }, 'total')).toBe(4800);
  });

  it('keeps the record as it is whatever the aggregate', () => {
    const columns = [
      { id: 'games', label: 'Matches', format: 'integer' },
      { id: 'winRate', label: 'Win Rate', format: 'percent' },
      { ...deaths, label: 'Deaths' },
    ] as const;
    expect(aggregateStats(games, columns, 'total')).toEqual({ games: 4, winRate: 1, Deaths: 8 });
  });
});

describe('groupGames', () => {
  it('splits by hero, role, map or mode, the largest group first', () => {
    const games = [
      game('1'),
      game('2', { hero: 'Sonya', role: 'warrior' }),
      game('3', { hero: 'Sonya', role: 'warrior', replay: replay('3', { map: 'Braxis Holdout' }) }),
      game('4', { hero: 'Abathur', role: null, replay: replay('4', { mode: 'aram' }) }),
    ];
    expect(groupGames(games, 'hero').map((g) => [g.key, g.games.length])).toEqual([
      ['Sonya', 2],
      ['Abathur', 1],
      ['Jaina', 1],
    ]);
    expect(groupGames(games, 'role').map((g) => g.key)).toEqual(['warrior', 'assassin', 'unknown']);
    expect(groupGames(games, 'map').map((g) => g.key)).toEqual(['Sky Temple', 'Braxis Holdout']);
    expect(groupGames(games, 'mode').map((g) => g.key)).toEqual(['quick-match', 'aram']);
  });
});

describe('playerRecords', () => {
  it('finds the highest of each stat and its match, the most recent of equals', () => {
    const games = [
      game('3', { stats: { Takedowns: 20, Healing: 0 } }),
      game('2', { stats: { Takedowns: 20 } }),
      game('1', { stats: { Takedowns: 5 } }),
    ];
    const columns = [
      { id: 'Takedowns', label: 'Takedowns', format: 'integer' },
      { id: 'Healing', label: 'Healing', format: 'integer' },
      { id: 'SiegeDamage', label: 'Siege Damage', format: 'integer' },
    ] as const;
    const records = playerRecords(games, columns);
    expect(records.map((r) => [r.column.id, r.value, r.game.replay.id])).toEqual([
      ['Takedowns', 20, '3'],
    ]);
  });
});

describe('playerPeers', () => {
  const others = (mate: string, foe: string): ReplaySummary['players'] =>
    [
      { slot: 0, toonHandle: '2-Hero-1-1', name: 'Ann', team: 0, kind: 'player' },
      { slot: 1, toonHandle: '2-Hero-1-2', name: mate, team: 0, kind: 'player' },
      { slot: 2, toonHandle: null, name: 'Bot', team: 0, kind: 'ai' },
      { slot: 5, toonHandle: '2-Hero-1-5', name: foe, team: 1, kind: 'player' },
    ] as unknown as ReplaySummary['players'];

  it("lists teammates and opponents with the player's own record in their matches", () => {
    const games = [
      game('2', { won: false, replay: replay('2', { players: others('Bobby', 'Eve') }) }),
      game('1', { won: true, replay: replay('1', { players: others('Bob', 'Eve') }) }),
    ];
    const peers = playerPeers(games);
    expect(peers.with).toEqual([
      {
        id: '2-Hero-1-2',
        name: 'Bobby', // the name from the most recent match
        games: 2,
        wins: 1,
        losses: 1,
        winRate: 0.5,
        lastPlayedAt: '2024-03-02T00:00:00.000Z',
      },
    ]);
    expect(peers.against.map((p) => [p.id, p.games])).toEqual([['2-Hero-1-5', 2]]);
  });
});

describe('awardCounts', () => {
  it('counts each award, most often first', () => {
    const games = [
      game('1', { awards: ['MostHealing'] }),
      game('2', { awards: ['MostHealing', 'Bulwark'] }),
    ];
    expect(awardCounts(games)).toEqual([
      { award: 'MostHealing', count: 2 },
      { award: 'Bulwark', count: 1 },
    ]);
  });
});
