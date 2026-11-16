import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  parseSeenImports,
  VIEWED_REPLAYS_STORAGE_KEY,
  ViewedReplaysStore,
} from './viewed-replays.store';

describe('ViewedReplaysStore', () => {
  beforeEach(() => localStorage.clear());

  it('remembers the import of each match you opened', () => {
    const store = TestBed.inject(ViewedReplaysStore);
    expect(store.seen()).toEqual({});

    store.markViewed('r1', '2024-06-02T09:15:00.000Z');
    store.markViewed('r2', '2024-06-03T09:15:00.000Z');
    store.markViewed('r1', '2024-07-01T00:00:00.000Z'); // imported again, opened again
    expect(store.seen()).toEqual({
      r1: '2024-07-01T00:00:00.000Z',
      r2: '2024-06-03T09:15:00.000Z',
    });

    TestBed.resetTestingModule();
    expect(TestBed.inject(ViewedReplaysStore).seen()).toEqual({
      r1: '2024-07-01T00:00:00.000Z',
      r2: '2024-06-03T09:15:00.000Z',
    });
  });

  it('ignores broken storage and malformed entries', () => {
    expect(parseSeenImports('{nope')).toEqual({});
    expect(parseSeenImports('[1]')).toEqual({});
    expect(parseSeenImports(JSON.stringify({ r1: 'a', r2: 7, r3: null }))).toEqual({ r1: 'a' });

    localStorage.setItem(VIEWED_REPLAYS_STORAGE_KEY, '{nope');
    expect(TestBed.inject(ViewedReplaysStore).seen()).toEqual({});
  });
});
