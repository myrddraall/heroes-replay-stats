import { describe, expect, it } from 'vitest';
import { stuckGroup } from './list-groups';
import { listRows } from './list-rows';

describe('stuckGroup', () => {
  // one item a row: [a] 0 1 [b] 2 3, headers 20px, items 100px, from 50px down the page
  const rows = listRows(4, 1, (i) => (i < 2 ? 'a' : 'b'));
  const sizes = rows.map((r) => (r.kind === 'group' ? 20 : 100));
  const places = sizes.map((size, index) => ({ index, size, start: 50 + sizes.slice(0, index).reduce((a, b) => a + b, 0) }));
  // starts: a 50, 0 70, 1 170, b 270, 2 290, 3 390

  it("has none while the list's first header still shows", () => {
    expect(stuckGroup(rows, places, 0)).toBeNull();
    expect(stuckGroup(rows, places, 50)).toBeNull();
  });

  it("keeps the group's header at the top, the next one pushing it up as it arrives", () => {
    expect(stuckGroup(rows, places, 100)).toEqual({ group: 'a', push: 0 });
    expect(stuckGroup(rows, places, 260)).toEqual({ group: 'a', push: -10 });
    expect(stuckGroup(rows, places, 300)).toEqual({ group: 'b', push: 0 });
  });

  it('pushes it by its own height when that is given (headers can differ)', () => {
    // the drawn headers are 20px; this one 30px: the next header (at 270) reaches it 10px sooner
    expect(stuckGroup(rows, places, 250)).toEqual({ group: 'a', push: 0 });
    expect(stuckGroup(rows, places, 250, 30)).toEqual({ group: 'a', push: -10 });
  });

  it('has none without groups', () => {
    const plain = listRows(3, 1);
    expect(stuckGroup(plain, plain.map((_, i) => ({ index: i, start: i * 100, size: 100 })), 150)).toBeNull();
  });
});
