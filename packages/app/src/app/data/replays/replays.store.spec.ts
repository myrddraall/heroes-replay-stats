import { TestBed } from '@angular/core/testing';
import type { ReplayDbClient } from '@myrddraall/heroprotocol-db/client';
import type { ReplayRecord } from '@myrddraall/heroprotocol-db/model';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM, type PickedReplay, type Platform } from '../../platform/platform';
import { REPLAY_DB } from './provide-replay-db';
import { ReplaysStore } from './replays.store';

const record = (id: string): ReplayRecord => ({ id, map: `Map ${id}` }) as unknown as ReplayRecord;

describe('ReplaysStore', () => {
  let ingested: { bytes: Uint8Array; fileName: string }[];
  let stored: ReplayRecord[];
  let pick: PickedReplay[];

  beforeEach(() => {
    ingested = [];
    stored = [];
    pick = [];
    const db = {
      ingest: (bytes: Uint8Array | ArrayBuffer, { fileName }: { fileName: string }) => {
        const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        ingested.push({ bytes: u8, fileName });
        const replay = record(fileName);
        stored.push(replay);
        const result = { replay, replayId: replay.id, jobId: 1, status: {} };
        return {
          ready: Promise.resolve(result),
          complete: Promise.resolve(result),
          status: () => () => undefined,
          latest: undefined,
        };
      },
      listReplays: async () => [...stored],
    } as unknown as ReplayDbClient;
    const platform: Platform = {
      kind: 'web',
      version: 't',
      pickReplays: async () => pick,
      defaultReplayDirectory: async () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: REPLAY_DB, useValue: db },
        { provide: PLATFORM, useValue: platform },
      ],
    });
  });

  it('list() loads the imported replays', async () => {
    stored.push(record('a'), record('b'));
    const store = TestBed.inject(ReplaysStore);
    expect(store.replays()).toEqual([]);
    expect(await store.list()).toHaveLength(2);
    expect(store.replays().map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('import() with no argument opens the dialog and imports what was picked', async () => {
    pick = [
      { name: 'one.StormReplay', bytes: new Uint8Array([1]) },
      { name: 'two.StormReplay', bytes: new Uint8Array([2]) },
    ];
    const store = TestBed.inject(ReplaysStore);
    const imported = await store.import();
    expect(imported.map((r) => r.id)).toEqual(['one.StormReplay', 'two.StormReplay']);
    expect(ingested.map((i) => i.fileName)).toEqual(['one.StormReplay', 'two.StormReplay']);
    expect(store.replays()).toHaveLength(2);
  });

  it('import(data) takes replay bytes', async () => {
    const store = TestBed.inject(ReplaysStore);
    await store.import(new Uint8Array([9, 9]), 'x.StormReplay');
    await store.import(new Uint8Array([7]).buffer);
    expect(ingested.map((i) => [i.fileName, [...i.bytes]])).toEqual([
      ['x.StormReplay', [9, 9]],
      ['replay.StormReplay', [7]],
    ]);
  });

  it('import(files) takes File objects and FileLists', async () => {
    const store = TestBed.inject(ReplaysStore);
    const f1 = new File([new Uint8Array([1, 2])], 'a.StormReplay');
    const f2 = new File([new Uint8Array([3])], 'b.StormReplay');
    await store.import(f1);
    await store.import([f2]);
    const list = {
      length: 1,
      item: () => f1,
      0: f1,
      [Symbol.iterator]: [f1][Symbol.iterator].bind([f1]),
    } as unknown as FileList;
    Object.setPrototypeOf(list, FileList.prototype);
    await store.import(list);
    expect(ingested.map((i) => [i.fileName, [...i.bytes]])).toEqual([
      ['a.StormReplay', [1, 2]],
      ['b.StormReplay', [3]],
      ['a.StormReplay', [1, 2]],
    ]);
  });

  it('import(handles) takes File System Access handles', async () => {
    const store = TestBed.inject(ReplaysStore);
    const handle = (name: string, bytes: number[]) =>
      ({
        kind: 'file',
        name,
        getFile: async () => new File([new Uint8Array(bytes)], name),
      }) as unknown as FileSystemFileHandle;
    await store.import(handle('h.StormReplay', [5]));
    await store.import([handle('i.StormReplay', [6]), handle('j.StormReplay', [7])]);
    expect(ingested.map((i) => i.fileName)).toEqual([
      'h.StormReplay',
      'i.StormReplay',
      'j.StormReplay',
    ]);
    expect(store.replays()).toHaveLength(3);
  });

  it('import() on a cancelled dialog imports nothing and leaves the list alone', async () => {
    const store = TestBed.inject(ReplaysStore);
    const spy = vi.fn();
    expect(await store.import()).toEqual([]);
    expect(ingested).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
