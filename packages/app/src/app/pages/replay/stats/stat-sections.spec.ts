import { describe, expect, it } from 'vitest';
import { STAT_COLUMNS } from './stat-columns';
import { DEFAULT_PRESET, STAT_SECTION_IDS, STAT_SECTIONS } from './stat-sections';
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
