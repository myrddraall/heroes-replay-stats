# ItemList
Every list of cards or rows: matches, maps, points of interest, chat, import jobs, the editor's libraries. One component, `hrs-item-list`; the items are the page's own (usually a Card or a ListRow), and the look is set by the page.
- **Items** come from `items` (an array, or a data source that loads ranges; items not loaded yet show placeholders) and are drawn with the page's `*hrsItem="let item"` template. Optional: `trackBy`, `[(selected)]` (`aria-current`: list items take no `aria-selected`), `(activate)`, `groupBy` with a `*hrsGroupHeader="let group"` template (matches by day, points of interest by town): a group's header stays at the top of the view while its items pass under it. `*hrsEmpty` for an empty list, `*hrsPlaceholder` to replace the default placeholder.
- **Columns** fit the space: as many as `--hrs-list-item-min-width` allows, each sharing the row equally; unset, one column. Items of different heights are measured as they are drawn (chat lines that wrap).
- **Only what is on screen is drawn**, in the page's own scroll, so any number of lists and grids can share a page. Coming back to a page returns it to where it was.
- **Roles:** `list`/`listitem` with `aria-setsize`/`aria-posinset`, so a screen reader still hears "12 of 570" when only a few are drawn. Arrow keys move between items, Home and End to the first and last.
- **The look is the page's**, through these custom properties on the element (defaults below):

| Property | Default | |
|---|---|---|
| `--hrs-list-item-min-width` | unset | the narrowest a column may be; unset: one column |
| `--hrs-list-gap` | `12px` | between items, both ways (chat: `0`) |
| `--hrs-list-group-font` | the `label` style | group headers |
| `--hrs-list-group-text` | `hrs-text-muted` | |
| `--hrs-list-group-background` | `hrs-film-raised` | under a group header while it sticks |
| `--hrs-list-placeholder-height` | `120px` | a placeholder until items are measured |

**Parts** (theme classes): `.hrs-items__row`, `.hrs-items__item`, `.hrs-items__group`, `.hrs-items__placeholder`.
**Consumer provides:** items, the item template, groups, selection, the look. **Material:** none; items are Cards or ListRows.
