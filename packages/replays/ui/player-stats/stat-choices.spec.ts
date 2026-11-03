import { describe, expect, it } from 'vitest';
import { allColumnChoices, sameShownColumns, shownColumnIds } from './stat-choices';

describe('stat column choices', () => {
  const ids = ['A', 'B', 'C', 'D'];

  it("keeps the section's choices first, then every other column hidden", () => {
    expect(
      allColumnChoices(
        [
          { id: 'C', shown: true },
          { id: 'A', shown: false },
        ],
        ids,
      ),
    ).toEqual([
      { id: 'C', shown: true },
      { id: 'A', shown: false },
      { id: 'B', shown: false },
      { id: 'D', shown: false },
    ]);
  });

  it('drops unknown and repeated columns', () => {
    expect(
      allColumnChoices(
        [
          { id: 'Gone', shown: true },
          { id: 'B', shown: true },
          { id: 'B', shown: false },
        ],
        ['B'],
      ),
    ).toEqual([{ id: 'B', shown: true }]);
  });

  it('lists the shown columns in order', () => {
    expect(
      shownColumnIds([
        { id: 'B', shown: true },
        { id: 'A', shown: false },
        { id: 'C', shown: true },
      ]),
    ).toEqual(['B', 'C']);
  });

  it('matches on the shown columns and their order only', () => {
    const preset = [
      { id: 'A', shown: true },
      { id: 'B', shown: false },
    ];
    const all = allColumnChoices(preset, ids);
    expect(sameShownColumns(preset, all)).toBe(true);
    expect(sameShownColumns(preset, [...all].reverse())).toBe(true);
    expect(
      sameShownColumns(
        preset,
        all.map((c) => (c.id === 'D' ? { ...c, shown: true } : c)),
      ),
    ).toBe(false);
    expect(
      sameShownColumns(
        [
          { id: 'A', shown: true },
          { id: 'C', shown: true },
        ],
        [
          { id: 'C', shown: true },
          { id: 'A', shown: true },
        ],
      ),
    ).toBe(false);
  });
});
