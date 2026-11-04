# DataGrid
Every table of data: stat tables, the score table, talents, the draft, unit kills, XP, team stats, players. One component, `hrs-data-grid`; what differs between tables is only how each page styles it.
- **Columns** are declared as children: `<hrs-column name="kills" header="Kills" width="6ch" align="end" sortable />`, with optional `hrsCell` and `hrsHeader` templates for anything beyond plain text (without a cell template, the item's field of the column's name). Columns can come from data (the stat tables' column picker). `width` is any grid track (`6ch`, `minmax(12em, 2fr)`, `minmax(min-content, max-content)` for columns that shrink to their longest word before the grid scrolls sideways, as a table's do). `rowHeader` marks the column whose cells name their rows (else the first); `cellClass` puts classes on its header and cells.
- **Rows** come from `items` (an array, or a data source that loads ranges; rows not loaded yet show placeholders). Optional: `trackBy`, `[(sort)]` with `sortStart` (Material's `matSort` and sort headers: `aria-sort`, the arrow; the page sorts the items), `rowTheme` (a row's `data-theme`, a team's: its colours follow), `groupBy` with a `*hrsGroupHeader` template (group rows), `*hrsEmpty`. Selecting rows (`[(selected)]`, `(activate)`) is for when a page needs it.
- **Only what is on screen is drawn.** The grid never scrolls up and down itself: it sits in the page at its full height and draws the rows inside the page's view, so any number of grids and lists can share a page. A grid wider than its space scrolls sideways inside itself; its header row stays at the top of the view while its rows pass under it, and its first column stays put while it scrolls sideways.
- **Built as a CSS grid with table roles** (`table`, `rowgroup`, `row`, `columnheader`, `cell`, `aria-rowcount`/`aria-rowindex`), so column widths hold while rows are reused. Coming back to a page returns it to where it was.
- **The look is the page's**, through these custom properties on the element (defaults below):

| Property | Default | |
|---|---|---|
| `--hrs-grid-row-height` | `40px` | a row's height (dense tables: `28px`) |
| `--hrs-grid-row-gap` | `0` | space between rows (separated rows, as the score table) |
| `--hrs-grid-cell-padding` | `0 12px` | |
| `--hrs-grid-font` | `400 13px/18px` plain | cells |
| `--hrs-grid-text` | `hrs-text-muted` | cells; the first column takes `--hrs-grid-first-text` (`hrs-text`) |
| `--hrs-grid-cell-wrap` | `nowrap` | `normal`: cells wrap (talents) |
| `--hrs-grid-header-height` | `32px` | the least a header is (`0px`: as its label) |
| `--hrs-grid-header-wrap` | `nowrap` | `normal`: labels wrap in narrow columns (stat tables) |
| `--hrs-grid-header-case` | `uppercase` | |
| `--hrs-grid-header-tracking` | `0.08em` | |
| `--hrs-grid-header-line` | the theme line | under each header |
| `--hrs-grid-header-cell-background` | `transparent` | each header; `--hrs-grid-header-background` the whole header row |
| `--hrs-grid-header-font` | the `label` style | uppercase header labels |
| `--hrs-grid-header-text` | `hrs-text-muted` | sorted header: `hrs-text` |
| `--hrs-grid-row-background` | `transparent` | each row's fill |
| `--hrs-grid-themed-row-background` | the row theme's `hrs-film` | a row with a theme's fill |
| `--hrs-grid-row-line` | a 35% hairline | the line under each row (`none` with separated rows) |
| `--hrs-grid-row-hover` | `hrs-film-hover` | |
| `--hrs-grid-row-selected` | `hrs-selection` | with an inset strong ring |
| `--hrs-grid-sticky-background` | `hrs-film-raised` | the first column while scrolling sideways |

**Row colours that follow a row's theme** (a team's) are set on the rows (`.hrs-grid__body .hrs-grid__row`), where its theme is: a custom property set on the grid takes the grid's colours.

**Parts** (theme classes): `.hrs-grid__head`, `.hrs-grid__body`, `.hrs-grid__row`, `.hrs-grid__header`, `.hrs-grid__cell`, `.hrs-grid__group`, `.hrs-grid__placeholder`; numeric columns (`align="end"`) put `.hrs-num` on their header and cells.
**Consumer provides:** items, columns and their templates, sort and selection state, the look. **Material:** `matSort` on the header row; no `mat-table` (see Table).

**Tests:** `provideWholeLists()` (`data-views/testing`) draws every row unmeasured, where there is no layout.
