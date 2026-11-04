import type { ListRow } from './list-rows';

/** Where a drawn row is laid out: its row, its place from the top of what scrolls, and its height. */
export interface RowPlace {
  readonly index: number;
  readonly start: number;
  readonly size: number;
}

/** The group header that stays at the top of the view, and how far the next one pushes it up. */
export interface StuckGroup {
  readonly group: string;
  /** How far up it is pushed, in px (0 or less). */
  readonly push: number;
}

/**
 * The header of the group the view's top (`top`, in the same measure as the places) is in,
 * among the drawn rows (`places`, in order, the rows around the view), once that header has
 * scrolled out of the view; the next group's header pushes it up as it reaches it. Null when the
 * view's top is not in a group, or above the list.
 */
export function stuckGroup(rows: readonly ListRow[], places: readonly RowPlace[], top: number): StuckGroup | null {
  if (places.length === 0 || places[0]!.start >= top) return null;
  // the last drawn row starting above the view's top
  let at = 0;
  while (at + 1 < places.length && places[at + 1]!.start < top) at++;
  const group = rows[places[at]!.index]?.group ?? null;
  if (group === null) return null;
  // a header's height (all are drawn alike): the first drawn one's
  const size = places.find((p) => rows[p.index]?.kind === 'group')?.size ?? 0;
  const next = places.slice(at + 1).find((p) => rows[p.index]?.kind === 'group');
  const push = next ? Math.min(0, next.start - top - size) : 0;
  return { group, push };
}
