import { describe, expect, it } from 'vitest';
import { ACTIVITY_COLUMN_IDS, STAT_COLUMNS, STAT_SOURCES } from '../../ui';
import { DEFAULT_PRESET, PER_MINUTE_PRESET, STAT_SECTION_IDS, STAT_SECTIONS } from '../../model';
import { withStatSupport } from './stats-section.store';

describe('stat sections', () => {
  const columnIds = new Set(STAT_COLUMNS.map((c) => c.id));

  it('gives every stat one column', () => {
    expect(columnIds.size).toBe(STAT_COLUMNS.length);
  });

  it('has a default preset in every section, naming only known columns, each once', () => {
    for (const id of STAT_SECTION_IDS) {
      const { presets } = STAT_SECTIONS[id];
      expect(presets[DEFAULT_PRESET], id).toBeDefined();
      for (const [name, choices] of Object.entries(presets)) {
        const ids = choices.map((c) => c.id);
        expect(
          ids.filter((c) => !columnIds.has(c)),
          `${id}/${name}`,
        ).toEqual([]);
        expect(new Set(ids).size, `${id}/${name}`).toBe(ids.length);
      }
    }
  });

  it('shows rates in each per-minute preset', () => {
    for (const id of ['pvp', 'tanking', 'pve', 'cc', 'healing'] as const) {
      const choices = STAT_SECTIONS[id].presets[PER_MINUTE_PRESET];
      expect(choices, id).toBeDefined();
      const rates = choices!.filter((c) => c.shown && c.id in STAT_SOURCES);
      expect(rates.length, id).toBeGreaterThan(0);
    }
  });

  it('works rates out from known stats, and reads the activity columns from their own table', () => {
    for (const source of Object.values(STAT_SOURCES)) expect(columnIds.has(source)).toBe(true);
    expect(
      STAT_SECTIONS.activity.presets[DEFAULT_PRESET]!.some((c) => ACTIVITY_COLUMN_IDS.has(c.id)),
    ).toBe(true);
  });

  it('marks a rate with the support of the stat it comes from, and an activity stat with none', () => {
    const rate = {
      id: 'DamageTakenPerMinute',
      label: 'Damage Taken / min',
      format: 'decimal',
    } as const;
    const support = { DamageTaken: { support: 'partial', note: 'Warriors only' } } as const;
    expect(withStatSupport(rate, support, 'DamageTaken')).toEqual({
      ...rate,
      support: 'partial',
      notes: ['Warriors only'],
    });
    const apm = { id: 'apm', label: 'APM', format: 'decimal' } as const;
    expect(withStatSupport(apm, { '*': { support: 'none', note: 'No score screen' } }, null)).toBe(
      apm,
    );
  });

  it("marks a column with the build's support for its stat, or for every stat", () => {
    const column = { id: 'DamageTaken', label: 'Damage Taken', format: 'integer' } as const;
    expect(withStatSupport(column, {})).toBe(column);
    expect(
      withStatSupport(column, { DamageTaken: { support: 'partial', note: 'Warriors only' } }),
    ).toEqual({ ...column, support: 'partial', notes: ['Warriors only'] });
    expect(withStatSupport(column, { '*': { support: 'none', note: 'No score screen' } })).toEqual({
      ...column,
      support: 'none',
      notes: ['No score screen'],
    });
  });
});
