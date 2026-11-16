# ItemList
Every list of cards or rows: matches, maps, points of interest, chat, import jobs, the editor's libraries. One component, `hrs-item-list`; the items are the page's own (usually a Card or a ListRow), and the look is set by the page.
- **Items** come from `items` (an array, or a data source that loads ranges; items not loaded yet show placeholders) and are drawn with the page's `*hrsItem="let item"` template. Optional: `trackBy`, `selectable` with `[(selected)]` (the chosen item is marked `aria-current`, as list items take no `aria-selected`, and kept in view, and moving to an item chooses it: points of interest), `(activate)`, `groupBy` with a `*hrsGroupHeader="let group"` template (matches by day, points of interest by town): a group's header stays at the top of the view while its items pass under it. `*hrsEmpty` for an empty list, `*hrsPlaceholder` to replace the default placeholder.
- **Columns** fit the space: as many as `--hrs-list-item-min-width` allows, each sharing the row equally; unset, one column. Items of different heights are measured as they are drawn (chat lines that wrap).
- **Only what is on screen is drawn**, in whatever scrolls it (the page, or a panel's body: the nearest parent with more in it than it shows), so any number of lists and grids can share a page. Coming back to a page returns it to where it was.
- **Roles:** `list`/`listitem` with `aria-setsize`/`aria-posinset`, so a screen reader still hears "12 of 570" when only a few are drawn. Arrow keys move between items, Home and End to the first and last. An item with a link or main button marks it `hrsItemFocus`: that takes the focus, and the list is one Tab stop (the current item), however long it is.
- **The look is the page's**, through these custom properties on the element (defaults below):

| Property | Default | |
|---|---|---|
| `--hrs-list-item-min-width` | unset | the narrowest a column may be; unset: one column |
| `--hrs-list-gap` | `12px` | between items, both ways (chat: `0`) |
| `--hrs-list-group-font` | the `label` style | group headers |
| `--hrs-list-group-text` | `hrs-text-muted` | |
| `--hrs-list-group-padding` | `0 4px` | around a group header |
| `--hrs-list-group-background` | `hrs-film-raised`, opaque | under a group header: what passes under it while it sticks is hidden |
| `--hrs-list-placeholder-height` | `120px` | a placeholder until items are measured |

**Parts** (theme classes): `.hrs-items__row`, `.hrs-items__item`, `.hrs-items__group` (a group's header row: its spacing and the background it sticks on), `.hrs-items__group-label` (the group's name as the list draws it without a `*hrsGroupHeader` template; a page's own template draws its header its own way), `.hrs-items__placeholder`.
**Consumer provides:** items, the item template, groups, selection, the look. **Material:** none; items are Cards or ListRows.

**Tests:** `provideWholeLists()` (`data-views/testing`) draws every row unmeasured, where there is no layout.
