import { describe, expect, it } from 'vitest';
import { listRows } from './list-rows';

describe('listRows', () => {
  it('fills rows of the given width, the last one short', () => {
    expect(listRows(7, 3).map((r) => (r.kind === 'items' ? [r.start, r.count] : r.group))).toEqual([
      [0, 3],
      [3, 3],
      [6, 1],
    ]);
  });

  it('starts each group with its header and on a new row', () => {
    const groups = ['Today', 'Today', 'Today', 'Yesterday', 'Yesterday'];
    const rows = listRows(groups.length, 2, (i) => groups[i]!);
    expect(rows.map((r) => (r.kind === 'group' ? `# ${r.group}` : `${r.start}+${r.count}`))).toEqual([
      '# Today',
      '0+2',
      '2+1',
      '# Yesterday',
      '3+2',
    ]);
  });

  it('has no rows for no items, and one column at least', () => {
    expect(listRows(0, 3)).toEqual([]);
    expect(listRows(2, 0).length).toBe(2);
  });
});
