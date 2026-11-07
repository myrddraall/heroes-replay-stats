/** A drawn row of an item list: a group's header, or up to a row's worth of its items. */
export type ListRow =
  | { readonly kind: 'group'; readonly group: string; readonly key: string }
  | { readonly kind: 'items'; readonly group: string | null; readonly start: number; readonly count: number; readonly key: string };

/**
 * The rows `count` items fill at `columns` a row: each group (as `groupOf` names them, in the
 * items' order) starts with its header row and starts its items on a new row.
 */
export function listRows(count: number, columns: number, groupOf?: (index: number) => string | null): ListRow[] {
  const rows: ListRow[] = [];
  const perRow = Math.max(1, Math.floor(columns));
  let index = 0;
  while (index < count) {
    const group = groupOf ? groupOf(index) : null;
    if (group !== null) rows.push({ kind: 'group', group, key: `g:${group}:${index}` });
    // the run of items in this group
    let end = index + 1;
    while (end < count && (groupOf ? groupOf(end) : null) === group) end++;
    for (let start = index; start < end; start += perRow) {
      rows.push({ kind: 'items', group, start, count: Math.min(perRow, end - start), key: `i:${start}` });
    }
    index = end;
  }
  return rows;
}
