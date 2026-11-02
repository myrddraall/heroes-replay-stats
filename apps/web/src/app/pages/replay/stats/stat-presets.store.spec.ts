import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseStatPresets, STAT_PRESETS_STORAGE_KEY, StatPresetsStore } from './stat-presets.store';

describe('StatPresetsStore', () => {
  beforeEach(() => localStorage.clear());

  const choices = [
    { id: 'Takedowns', shown: true },
    { id: 'Deaths', shown: false },
  ];

  it('remembers saved presets per section, and forgets deleted ones', () => {
    const store = TestBed.inject(StatPresetsStore);
    store.save('pvp', 'Mine', choices);
    store.save('tanking', 'Soak', choices);
    expect(store.saved()).toEqual({ pvp: { Mine: choices }, tanking: { Soak: choices } });

    TestBed.resetTestingModule();
    const again = TestBed.inject(StatPresetsStore);
    expect(again.saved().pvp).toEqual({ Mine: choices });

    again.remove('pvp', 'Mine');
    expect(again.saved().pvp).toEqual({});
    expect(JSON.parse(localStorage.getItem(STAT_PRESETS_STORAGE_KEY)!)).toEqual({
      pvp: {},
      tanking: { Soak: choices },
    });
  });

  it('keeps only well-formed presets of known sections', () => {
    expect(parseStatPresets(null)).toEqual({});
    expect(parseStatPresets('not json')).toEqual({});
    expect(
      parseStatPresets(
        JSON.stringify({
          pvp: { Good: choices, Bad: [{ id: 1 }], Worse: 'x' },
          nowhere: { Lost: choices },
          cc: null,
        }),
      ),
    ).toEqual({ pvp: { Good: choices } });
  });
});
