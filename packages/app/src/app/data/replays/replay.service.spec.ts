import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { TestBed } from '@angular/core/testing';
import { HeroDb, type ReplayRecord } from '@myrddraall/heroprotocol-db';
import Dexie from 'dexie';
import type { ReplayDbClient } from '@myrddraall/heroprotocol-db/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REPLAY_DB } from '../import/provide-replay-db';
import { ReplayService } from './replay.service';

/** A stored replay with just the fields the service reads. */
function record(id: string, over: Partial<ReplayRecord> = {}): ReplayRecord {
  return {
    id,
    map: 'Towers of Doom',
    mode: 'quick-match',
    playedAt: '2024-01-01T00:00:00.000Z',
    ingestedAt: '2024-01-02T00:00:00.000Z',
    durationSeconds: 1200,
    winningTeam: 0,
    version: { baseBuild: 85267, build: 85267, major: 2, minor: 55, revision: 0 },
    status: 'complete',
    players: [
      { slot: 1, name: 'B', hero: 'Jaina', heroId: 'Jaina', team: 0, won: true, kind: 'player' },
      { slot: 0, name: 'A', hero: 'Sonya', heroId: 'Barbarian', team: 0, won: true, kind: 'ai' },
      { slot: 10, name: 'Obs', hero: '', heroId: '', team: null, won: null, kind: 'observer' },
    ],
    ...over,
  } as ReplayRecord;
}

async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(check()).toBe(true);
}

// The test bundle loads Dexie before this file runs, so hand it the in-memory IndexedDB directly.
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

describe('ReplayService', () => {
  let db: HeroDb;
  let open: (value: unknown) => void;

  beforeEach(async () => {
    db = await HeroDb.open(`replay-service-${Math.random()}`, {});
    const ready = new Promise((r) => (open = r));
    TestBed.configureTestingModule({
      providers: [{ provide: REPLAY_DB, useValue: { ready, db } as unknown as ReplayDbClient }],
    });
  });
  afterEach(async () => {
    await db.delete();
  });

  it('lists available replays with their basic info, most recently played first', async () => {
    await db.replays.bulkPut([
      record('old', { playedAt: '2023-05-01T00:00:00.000Z', status: 'ready' }),
      record('new', { playedAt: '2024-06-01T00:00:00.000Z', map: 'Cursed Hollow' }),
      record('importing', { playedAt: '2025-01-01T00:00:00.000Z', status: 'analysing' }),
      record('broken', { playedAt: '2025-01-01T00:00:00.000Z', status: 'failed' }),
    ]);
    const service = TestBed.inject(ReplayService);
    expect(service.loaded()).toBe(false);
    expect(service.replays()).toEqual([]);

    open(undefined);
    await until(() => service.loaded());
    expect(service.replays().map((r) => [r.id, r.status])).toEqual([
      ['new', 'complete'],
      ['old', 'ready'],
    ]);
    const [latest] = service.replays();
    expect(latest).toEqual({
      id: 'new',
      map: 'Cursed Hollow',
      mode: 'quick-match',
      playedAt: '2024-06-01T00:00:00.000Z',
      durationSeconds: 1200,
      winningTeam: 0,
      build: 85267,
      status: 'complete',
      players: [
        { slot: 0, name: 'A', hero: 'Sonya', heroId: 'Barbarian', team: 0, won: true, kind: 'ai' },
        { slot: 1, name: 'B', hero: 'Jaina', heroId: 'Jaina', team: 0, won: true, kind: 'player' },
      ],
    });
    expect(service.error()).toBeNull();
  });

  it('updates as replays are stored, finish analysing and are deleted', async () => {
    const service = TestBed.inject(ReplayService);
    open(undefined);
    await until(() => service.loaded());
    expect(service.replays()).toEqual([]);

    await db.replays.put(record('a', { status: 'analysing' }));
    await db.replays.put(record('b', { playedAt: '2024-02-01T00:00:00.000Z' }));
    await until(() => service.replays().length === 1);
    expect(service.replays()[0]!.id).toBe('b');

    await db.replays.update('a', { status: 'ready' });
    await until(() => service.replays().length === 2);
    expect(service.replays().map((r) => r.id)).toEqual(['b', 'a']);

    await db.replays.delete('b');
    await until(() => service.replays().length === 1);
    expect(service.replays()[0]!.id).toBe('a');
  });

  it('reports a database that fails to open', async () => {
    TestBed.resetTestingModule();
    const failing = Promise.reject(new Error('blocked'));
    failing.catch(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: REPLAY_DB, useValue: { ready: failing, db } as unknown as ReplayDbClient },
      ],
    });
    const service = TestBed.inject(ReplayService);
    await until(() => service.error() !== null);
    expect((service.error() as Error).message).toBe('blocked');
    expect(service.loaded()).toBe(false);
  });
});
