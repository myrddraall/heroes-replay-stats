import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { TestBed } from '@angular/core/testing';
import { HeroDb, type PlayerRecord, type ReplayRecord } from '@myrddraall/heroprotocol-db';
import type { ReplayDbClient } from '@myrddraall/heroprotocol-db/client';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { REPLAY_DB } from '../import/provide-replay-db';
import { PlayerService, summarisePlayers } from './player.service';

// The test bundle loads Dexie before this file runs, so hand it the in-memory IndexedDB directly.
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const replay = (id: string, playedAt: string, status: ReplayRecord['status'] = 'complete') =>
  ({ id, playedAt, status, ingestedAt: playedAt }) as ReplayRecord;

function player(
  replayId: string,
  slot: number,
  name: string,
  hero: string,
  won: boolean | null,
  over: Partial<PlayerRecord> = {},
): PlayerRecord {
  return {
    replayId,
    slot,
    name,
    hero,
    won,
    kind: 'player',
    team: slot < 5 ? 0 : 1,
    toon: { id: slot, realm: 1, region: 2, programId: 'Hero', handle: `2-Hero-1-${name}` },
    ...over,
  } as PlayerRecord;
}

describe('summarisePlayers', () => {
  it('groups by account across available replays, with games, results, last name and heroes', () => {
    const players = summarisePlayers({
      replays: [
        replay('r0', '2023-06-01T00:00:00.000Z'),
        replay('r1', '2024-01-01T00:00:00.000Z'),
        replay('r2', '2024-03-01T00:00:00.000Z', 'ready'),
        replay('r3', '2024-05-01T00:00:00.000Z', 'analysing'), // not available yet
      ],
      players: [
        player('r0', 0, 'Ann', 'Jaina', null),
        player('r1', 0, 'Ann', 'Jaina', true),
        // the same account, renamed, in the most recent game
        player('r2', 3, 'Anna', 'Sonya', false, {
          toon: { id: 0, realm: 1, region: 2, programId: 'Hero', handle: '2-Hero-1-Ann' },
        }),
        player('r1', 5, 'Bob', 'Muradin', false),
        player('r3', 6, 'Cat', 'Li-Ming', true),
        player('r1', 7, 'Bot', 'Raynor', true, { kind: 'ai', toon: null }),
        player('r1', 12, 'Obs', '', null, { kind: 'observer' }),
        player('r1', 8, 'NoToon', 'Tyrael', true, { toon: null }),
      ],
    });
    expect(players.map((p) => p.id)).toEqual(['2-Hero-1-Ann', '2-Hero-1-Bob', 'name:NoToon']);
    const [ann, bob] = players;
    expect(ann).toMatchObject({
      name: 'Anna',
      region: 2,
      games: 3,
      wins: 1,
      losses: 1,
      winRate: 0.5,
      lastPlayedAt: '2024-03-01T00:00:00.000Z',
      heroes: [
        { hero: 'Jaina', games: 2 },
        { hero: 'Sonya', games: 1 },
      ],
    });
    expect(bob).toMatchObject({ games: 1, wins: 0, losses: 1, winRate: 0 });
    expect(players[2]).toMatchObject({ name: 'NoToon', region: null, winRate: 1 });
  });

  it('has no win rate without known results', () => {
    const [p] = summarisePlayers({
      replays: [replay('r1', '2024-01-01T00:00:00.000Z')],
      players: [player('r1', 0, 'Ann', 'Jaina', null)],
    });
    expect(p!.winRate).toBeNull();
  });
});

describe('PlayerService', () => {
  let db: HeroDb;
  afterEach(async () => {
    await db.delete();
  });

  it('is live: players appear as replays become available and go when they are deleted', async () => {
    db = await HeroDb.open(`player-service-${Math.random()}`, {});
    TestBed.configureTestingModule({
      providers: [
        {
          provide: REPLAY_DB,
          useValue: { ready: Promise.resolve(), db } as unknown as ReplayDbClient,
        },
      ],
    });
    const service = TestBed.inject(PlayerService);
    const until = async (check: () => boolean) => {
      for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
      expect(check()).toBe(true);
    };
    await until(() => service.loaded());
    expect(service.players()).toEqual([]);

    await db.replays.put(replay('r1', '2024-01-01T00:00:00.000Z', 'analysing'));
    await db.players.bulkPut([player('r1', 0, 'Ann', 'Jaina', true)]);
    await new Promise((r) => setTimeout(r, 50));
    expect(service.players()).toEqual([]);

    await db.replays.update('r1', { status: 'ready' });
    await until(() => service.players().length === 1);
    expect(service.players()[0]).toMatchObject({ name: 'Ann', games: 1, wins: 1 });

    await db.transaction('rw', db.replays, db.players, async () => {
      await db.replays.delete('r1');
      await db.players.where('replayId').equals('r1').delete();
    });
    await until(() => service.players().length === 0);
  });
});
