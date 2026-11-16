import { DOCUMENT, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DEFAULT_DB_NAME } from '@myrddraall/heroprotocol-db/db';
import { Dexie } from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { MatchDataService } from './match-data.service';
import { REPLAY_DB } from './replay-db';
import { ReplayImportJobStore } from './replay-import-job.store';

// The test bundle loads Dexie before this file runs, so hand it the in-memory IndexedDB directly.
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

describe('MatchDataService', () => {
  it('deletes the replay database, empties the import list and starts the app again', async () => {
    const name = DEFAULT_DB_NAME;
    const db = new Dexie(name);
    db.version(1).stores({ replays: 'id' });
    await db.table('replays').add({ id: 'a' });

    const steps: string[] = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: REPLAY_DB,
          useValue: {
            close: async () => {
              steps.push('close');
              db.close();
            },
          },
        },
        {
          provide: ReplayImportJobStore,
          useValue: {
            entities: signal([{ id: 'a' }, { id: 'b' }]),
            dismiss: (id: string) => steps.push(`dismiss ${id}`),
          },
        },
        { provide: DOCUMENT, useValue: { location: { reload: () => steps.push('reload') } } },
      ],
    });

    await TestBed.inject(MatchDataService).clear();

    expect(steps).toEqual(['dismiss a', 'dismiss b', 'close', 'reload']);
    expect(await Dexie.exists(name)).toBe(false);
  });
});
